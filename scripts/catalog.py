#!/usr/bin/env python3
"""Metadata-only full QDN inventory and resumable, evidence-preserving enrichment."""
import argparse
import collections
import copy
import datetime as dt
import hashlib
import http.client
import json
import os
from pathlib import Path
import re
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request

AGENT = 'EarBumpCatalog/0.1.0 (https://github.com/crowetic/ear-bump)'


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')


def write(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')) + '\n')
    os.replace(temporary, path)


def norm(value):
    return ' '.join(unicodedata.normalize('NFKC', value).casefold().split())


def identity(song):
    return song['service'], song['name'].casefold(), song.get('identifier', song.get('id'))


class Client:
    def __init__(self, cache, interval=1.1):
        self.cache = Path(cache)
        self.interval = interval
        self.last_request = {}

    def get(self, url, cached=True):
        key = hashlib.sha256(url.encode()).hexdigest()
        path = self.cache / (key + '.json')
        if cached and path.exists():
            return json.loads(path.read_text())
        host = urllib.parse.urlsplit(url).netloc
        for attempt in range(4):
            time.sleep(max(0, self.last_request.get(host, 0) + self.interval - time.monotonic()))
            self.last_request[host] = time.monotonic()
            try:
                request = urllib.request.Request(url, headers={'User-Agent': AGENT, 'Accept': 'application/json'})
                with urllib.request.urlopen(request, timeout=35) as response:
                    value = json.load(response)
                if cached:
                    write(path, value)
                return value
            except (urllib.error.URLError, TimeoutError, http.client.HTTPException, json.JSONDecodeError) as error:
                if isinstance(error, urllib.error.HTTPError) and error.code not in (408, 429, 500, 502, 503, 504):
                    raise
                if attempt == 3:
                    raise
                retry_after = error.headers.get('Retry-After', '') if isinstance(error, urllib.error.HTTPError) else ''
                delay = float(retry_after) if retry_after.isdigit() else 2 ** (attempt + 1)
                print(f'retry {host}: {error}; waiting {delay}s', flush=True)
                time.sleep(delay)


def url(base, path, **query):
    return base.rstrip('/') + path + '?' + urllib.parse.urlencode(query)


def scan(client, core, prefix, exclude_blocked=False):
    """Continue through short server-capped pages; stop only at an empty page."""
    songs, offset = {}, 0
    while True:
        page = client.get(url(core, '/arbitrary/resources/search', mode='ALL', service='AUDIO',
                              identifier=prefix, limit=100, offset=offset, reverse='false',
                              includemetadata='true', excludeblocked=str(exclude_blocked).lower()), cached=False)
        if not isinstance(page, list):
            raise ValueError('QDN did not return a resource array')
        if not page:
            return list(songs.values())
        for song in page:
            if song.get('service') != 'AUDIO' or not song.get('identifier', '').startswith(prefix):
                raise ValueError('Unexpected resource in QDN inventory')
            key = identity(song)
            if key in songs:
                raise ValueError('Repeated QDN identity: unstable paging; rerun the snapshot')
            songs[key] = song
        offset += len(page)
        print(f'QDN {prefix}: {offset}', flush=True)


def pull(args, client):
    songs = scan(client, args.core, args.prefix, args.exclude_blocked)
    # Verify enumeration against a second inventory before replacing the last snapshot.
    check = scan(client, args.core, args.prefix, args.exclude_blocked)
    signatures = lambda rows: {identity(row): row.get('latestSignature') for row in rows}
    if signatures(songs) != signatures(check):
        raise ValueError('Catalog changed during scan; previous snapshot retained, rerun')
    previous = {identity(row): row for row in json.loads(Path(args.metadata_seed).read_text())} if Path(args.metadata_seed).exists() else {}
    failures = []
    for song in songs:
        saved = previous.get(identity(song), {})
        if not song.get('metadata') and saved.get('latestSignature') == song.get('latestSignature') and saved.get('metadata'):
            song['metadata'] = saved['metadata']
            song['metadataEvidence'] = 'Recovered prior metadata, same QDN transaction signature'

        if song.get('metadata'):
            continue
        print(f"Recovering metadata: {song['name']}/{song['identifier']}", flush=True)
        try:
            path = '/arbitrary/metadata/AUDIO/' + urllib.parse.quote(song['name'], safe='') + '/' + urllib.parse.quote(song['identifier'], safe='')
            metadata = client.get(args.core.rstrip('/') + path, cached=False)
            if not isinstance(metadata, dict) or not (metadata.get('title') or metadata.get('description')):
                raise ValueError('No usable publisher metadata')
            song['metadata'] = metadata
            song['metadataEvidence'] = path
        except (urllib.error.URLError, TimeoutError, http.client.HTTPException, ValueError) as error:
            failures.append({'identity': identity(song), 'error': str(error)})
    write(args.source, songs)
    write(Path(args.output) / 'pull-report.json', {'at': now(), 'core': args.core, 'prefix': args.prefix,
          'scope': 'All AUDIO identities for prefix; no audio downloads', 'excludesNodeBlockedNames': args.exclude_blocked,
          'count': len(songs), 'verifiedWithSecondScan': True, 'missingMetadata': failures,
          'sourceSha256': hashlib.sha256(Path(args.source).read_bytes()).hexdigest()})


def fields(song):
    metadata = song.get('metadata') or {}
    compact = {}
    for pair in metadata.get('description', '').split(';'):
        if '=' in pair:
            key, value = pair.split('=', 1)
            compact[key.strip().lower()] = value.strip()
    if compact.get('v') in ('2', 'earbump1'):
        compact = {key: urllib.parse.unquote(value) for key, value in compact.items()}
    return {**compact, **{key: value for key, value in metadata.items() if value is not None and value != ''}}


def quote(value):
    return '"' + re.sub(r'([+\-!(){}\[\]^"~*?:\\/|&])', r'\\\1', value) + '"'


def search(client, entity, query, allow_limited=False):
    rows, offset, total = {}, 0, None
    while True:
        result = client.get(url('https://musicbrainz.org', '/ws/2/' + entity, query=query,
                                fmt='json', limit=100, offset=offset))
        count = result.get('count')
        page = result.get(entity + 's')
        if not isinstance(count, int) or not isinstance(page, list):
            raise ValueError('Malformed MusicBrainz search response')
        if total is None:
            total = count
            if total > 100 and allow_limited:
                return [{**row, '_providerResultLimited': True} for row in page]
            if total > 500:
                raise ValueError('MusicBrainz provider result limit: narrow the query')
        if total != count:
            raise ValueError('MusicBrainz result count changed during pagination')
        if not page:
            if offset < total:
                raise ValueError('MusicBrainz search ended before reported total')
            return list(rows.values())
        # Search score ties can repeat a recording across pages. Deduplicate evidence,
        # but still advance through every provider-reported result position.
        for row in page:
            rows[row['id']] = row
        offset += len(page)
        if offset >= total:
            return list(rows.values())



def recording_results(client, pairs):
    query = ' OR '.join('(artist:' + quote(artist) + ' AND recording:' + quote(title) + ')' for artist, title in pairs)
    try:
        rows = search(client, 'recording', query, allow_limited=True)
        results = {pair: (rows, None) for pair in pairs}
        # Large live/alternate-version catalogs must not crowd other songs off the
        # result page. Narrow queries for every pair without an exact returned match.
        missing = [pair for pair in pairs if not matching_recordings(rows, *pair)]
        if len(pairs) > 1 and missing and any(row.get('_providerResultLimited') for row in rows):
            if len(missing) == len(pairs):
                middle = len(pairs) // 2
                results.update(recording_results(client, pairs[:middle]))
                results.update(recording_results(client, pairs[middle:]))
            else:
                results.update(recording_results(client, missing))
        return results
    except (urllib.error.URLError, TimeoutError, http.client.HTTPException, ValueError) as error:
        # Provider clause/query limits vary with title length. Split rejected batches
        # without making one malformed or unstable lookup hide the rest of the songs.
        if len(pairs) > 1 and (isinstance(error, ValueError) or isinstance(error, urllib.error.HTTPError) and error.code == 400):
            middle = len(pairs) // 2
            return {**recording_results(client, pairs[:middle]), **recording_results(client, pairs[middle:])}
        if len(pairs) == 1 and isinstance(error, ValueError) and 'provider result limit' in str(error):
            # A single recording can have hundreds of live/alternate versions. Preserve
            # evidence from the available page and explicitly flag the provider limit.
            try:
                return {pairs[0]: (search(client, 'recording', query, allow_limited=True), None)}
            except (urllib.error.URLError, TimeoutError, http.client.HTTPException, ValueError) as limited_error:
                return {pairs[0]: ([], str(limited_error))}
        return {pair: ([], str(error)) for pair in pairs}


def genre_names(client):
    names, offset = set(), 0
    while True:
        result = client.get(url('https://musicbrainz.org', '/ws/2/genre/all', fmt='json', limit=100, offset=offset))
        page = result['genres']
        names.update(norm(row['name']) for row in page)
        offset += len(page)
        if offset >= result['genre-count']:
            return names
        if not page:
            raise ValueError('Incomplete MusicBrainz genre registry')


def matching_recordings(rows, artist, title):
    return [row for row in rows if norm(row['title']) == norm(title) and
            norm(''.join(credit.get('name', credit.get('artist', {}).get('name', '')) + credit.get('joinphrase', '')
                         for credit in row.get('artist-credit', []))) == norm(artist)]


def choose_genre(rows, allowed):
    votes = collections.Counter()
    for row in rows:
        for tag in row.get('genres', row.get('tags', [])):
            label, count = norm(tag['name']), tag.get('count', 0)
            if label in allowed and count > 0:
                votes[label] += count
    if not votes:
        return None
    ranked = votes.most_common()
    if len(ranked) > 1 and ranked[0][1] == ranked[1][1]:
        return None  # Avoid assigning an arbitrary winner when evidence is tied.
    return ranked[0][0]


def enrich(args, client):
    source = json.loads(Path(args.source).read_text())
    if len({identity(row) for row in source}) != len(source):
        raise ValueError('Duplicate source identities')
    baseline = json.loads(Path(args.baseline).read_text())
    prior = {identity(row): row for row in baseline['songs']}
    checkpoint_path = Path(args.output) / 'genres.json'
    if checkpoint_path.exists():
        checkpoint = json.loads(checkpoint_path.read_text())
        if checkpoint.get('revision') == args.revision:
            for row in checkpoint['songs']:
                lookup = row.get('lookup', {})
                if lookup.get('status') not in (None, 'pending', 'error'):
                    prior[identity(row)] = row
    entries, pairs = [], collections.defaultdict(list)
    for song in source:
        f = fields(song)
        title, artist = f.get('title', '').strip(), (f.get('artist') or f.get('author') or '').strip()
        entry = copy.deepcopy(prior.get(identity(song), {}))
        entry.update(name=song['name'], service='AUDIO', identifier=song['identifier'],
                     title=title or 'Unknown title', artist=artist or 'Unknown artist',
                     created=song.get('created'), genre=f.get('genre') or entry.get('genre') or 'Uncategorized')
        previous_signature = entry.get('provenance', {}).get('sourceSignature')
        entry['provenance'] = {**entry.get('provenance', {}), 'sourceSignature': song.get('latestSignature')}
        if isinstance(song.get('created'), (int, float)):
            entry['publishedAt'] = dt.datetime.fromtimestamp(song['created'] / 1000, dt.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')
        entry['missingMetadataFields'] = [key for key, value in [('title', title), ('artist', artist)] if not value]
        if f.get('genre'):
            entry.update(confidence='verified', evidence='Publisher explicitly supplies genre.')
            entry['provenance'].update(method='publisher-genre', confidence='verified')
        entries.append(entry)
        if title and artist and norm(title) != 'deleted':
            lookup = entry.get('lookup', {})
            completed = (lookup.get('status') not in (None, 'pending', 'error', 'missing-identity')
                         and lookup.get('artist') == artist and lookup.get('title') == title
                         and previous_signature == song.get('latestSignature'))
            if not completed:
                entry.pop('lookup', None)
                pairs[(artist, title)].append(entry)
        else:
            entry['lookup'] = {'status': 'missing-identity', 'at': now()}
    allowed = genre_names(client)
    pair_list = list(pairs)
    print(f'Looking up {len(pair_list)} distinct pairs for {len(entries)} songs', flush=True)
    for start in range(0, len(pair_list), args.batch_size):
        batch = pair_list[start:start + args.batch_size]
        results = recording_results(client, batch)
        for artist, title in batch:
            rows, error = results[(artist, title)]
            matches = matching_recordings(rows, artist, title)
            artist_sets = {tuple(credit['artist']['id'] for credit in row.get('artist-credit', []) if credit.get('artist', {}).get('id')) for row in matches}
            ambiguous = len(artist_sets) > 1
            genre = None if ambiguous else choose_genre(matches, allowed)
            method = 'musicbrainz-recording-tags'
            reference_urls = ['https://musicbrainz.org/recording/' + row['id'] for row in matches]
            if not genre and not ambiguous and matches and any(norm(entry['genre']) == 'uncategorized' for entry in pairs[(artist, title)]):
                artist_ids = next(iter(artist_sets), ())
                if len(artist_ids) == 1:
                    try:
                        detail = client.get(url('https://musicbrainz.org', '/ws/2/artist/' + artist_ids[0], inc='genres', fmt='json'))
                        genre = choose_genre([detail], allowed)
                        if genre:
                            method = 'musicbrainz-linked-artist-genre'
                            reference_urls = ['https://musicbrainz.org/artist/' + artist_ids[0]]
                    except (urllib.error.URLError, TimeoutError, http.client.HTTPException, ValueError) as exc:
                        error = str(exc)
            status = 'error' if error else ('matched-artist-genre' if method == 'musicbrainz-linked-artist-genre' else 'matched-genre') if genre else 'ambiguous-match' if ambiguous else 'matched-no-genre' if matches else 'result-limit' if any(row.get('_providerResultLimited') for row in rows) else 'no-exact-match'
            for entry in pairs[(artist, title)]:
                entry['lookup'] = {'status': status, 'provider': 'MusicBrainz', 'artist': artist, 'title': title,
                                   'at': now(), 'recordingIds': [row['id'] for row in matches],
                                   'providerResultLimited': any(row.get('_providerResultLimited') for row in rows)}
                if error:
                    entry['lookup']['error'] = error
                if genre:
                    entry['lookup']['genre'] = genre
                # Native genre always wins; external recording evidence replaces editorial inference.
                if genre and entry.get('confidence') != 'verified':
                    entry.update(genre=genre, confidence='inferred', evidence=('MusicBrainz community tags for the artist linked by exact recording match; broad artist inference, not recording verification.' if method == 'musicbrainz-linked-artist-genre' else 'MusicBrainz community genre tags on exact artist/title matches; not acoustic verification.'))
                    entry.pop('classificationStatus', None)
                    entry['provenance'].update(method=method, confidence='inferred',
                         classifiedAt=now(), referenceUrls=reference_urls)
        # Save checkpoints after each batch; failures are retried on rerun, never success-cached.
        finalize(args, entries, source)
        print(f'Lookups {min(start + len(batch), len(pair_list))}/{len(pair_list)}', flush=True)
    report = finalize(args, entries, source)
    return 0 if report['complete'] else 2



def artist_results(client, artists):
    query = ' OR '.join('artist:' + quote(artist) for artist in artists)
    try:
        rows = search(client, 'artist', query)
        return {artist: (rows, None) for artist in artists}
    except (urllib.error.URLError, TimeoutError, http.client.HTTPException, ValueError) as error:
        if len(artists) > 1 and (isinstance(error, ValueError) or isinstance(error, urllib.error.HTTPError) and error.code == 400):
            middle = len(artists) // 2
            return {**artist_results(client, artists[:middle]), **artist_results(client, artists[middle:])}
        return {artist: ([], str(error)) for artist in artists}


def enrich_artists(args, client):
    output = Path(args.output)
    document = json.loads((output / 'genres.json').read_text())
    source = json.loads(Path(args.source).read_text())
    entries = document['songs']
    if {identity(row) for row in entries} != {identity(row) for row in source}:
        raise ValueError('Artist fallback must use the same complete source inventory')
    if any(row.get('lookup', {}).get('status', 'pending') == 'pending' for row in entries):
        raise ValueError('Finish recording lookups before artist fallback')
    allowed = genre_names(client)
    artists = collections.defaultdict(list)
    for entry in entries:
        if norm(entry['genre']) == 'uncategorized' and not entry.get('missingMetadataFields'):
            artists[entry['artist']].append(entry)
    names = list(artists)
    print(f'Artist fallback for {len(names)} distinct artists', flush=True)
    for start in range(0, len(names), 10):
        batch = names[start:start + 10]
        results = artist_results(client, batch)
        for name in batch:
            rows, error = results[name]
            matches = [row for row in rows if norm(row.get('name', '')) == norm(name)]
            genre = choose_genre(matches, allowed) if len(matches) == 1 else None
            status = 'error' if error else 'ambiguous-artist' if len(matches) > 1 else 'matched-artist-genre' if genre else 'no-artist-genre' if matches else 'no-exact-artist'
            for entry in artists[name]:
                evidence = {'status': status, 'at': now(), 'artistIds': [row['id'] for row in matches]}
                if error:
                    evidence['error'] = error
                entry['lookup']['artistFallback'] = evidence
                if genre:
                    entry.update(genre=genre, confidence='inferred', evidence='Broad genre from MusicBrainz tags for a unique exact artist name; recording identity not verified by this fallback.')
                    entry.pop('classificationStatus', None)
                    entry['provenance'].update(method='musicbrainz-exact-artist-tags', confidence='inferred', confidenceLevel='medium', classifiedAt=now(),
                        referenceUrls=['https://musicbrainz.org/artist/' + matches[0]['id']])
        finalize(args, entries, source)
        print(f'Artist fallback {min(start + len(batch), len(names))}/{len(names)}', flush=True)
    report = finalize(args, entries, source)
    return 0 if report['complete'] else 2



def apple_genre(rows, artist, title, limited):
    named = [row for row in rows if norm(row.get('artistName', '')) == norm(artist)]
    identities = {row.get('artistId') for row in named}
    exact_artist = [row for row in named if row.get('primaryGenreName') not in (None, '', 'Music')]
    if len(identities) != 1 or None in identities:
        return None, [], 'ambiguous-or-missing-artist'
    exact_track = [row for row in exact_artist if norm(row.get('trackName', '')) == norm(title)]
    candidates = exact_track or ([] if limited else exact_artist)
    counts = collections.Counter(row['primaryGenreName'] for row in candidates)
    ranked = counts.most_common()
    if not ranked or len(ranked) > 1 and ranked[0][1] == ranked[1][1]:
        return None, [], 'no-unambiguous-genre'
    genre = ranked[0][0]
    evidence = [row for row in candidates if row['primaryGenreName'] == genre]
    return genre, evidence, 'exact-track' if exact_track else 'artist-context'


def enrich_secondary(args, client):
    output = Path(args.output)
    document = json.loads((output / 'genres.json').read_text())
    source = json.loads(Path(args.source).read_text())
    entries = document['songs']
    if {identity(row) for row in entries} != {identity(row) for row in source}:
        raise ValueError('Secondary fallback must use the same source inventory')
    if any(row.get('lookup', {}).get('status', 'pending') == 'pending' for row in entries):
        raise ValueError('Finish recording lookups before secondary fallback')
    artists = collections.defaultdict(list)
    for entry in entries:
        if norm(entry['genre']) == 'uncategorized' and not entry.get('missingMetadataFields'):
            artists[entry['artist']].append(entry)
    for index, (artist, songs) in enumerate(artists.items()):
        try:
            result = client.get(url('https://itunes.apple.com', '/search', term=artist, media='music', entity='song', attribute='artistTerm', limit=200))
            rows = result['results']
            if not isinstance(rows, list):
                raise ValueError('Invalid iTunes search response')
            error = None
        except (urllib.error.URLError, TimeoutError, http.client.HTTPException, ValueError) as exc:
            rows, error = [], str(exc)
        for entry in songs:
            genre, matches, method = apple_genre(rows, artist, entry['title'], len(rows) >= 200)
            evidence = {'provider': 'iTunes', 'at': now(), 'status': 'error' if error else method,
                        'providerResultLimited': len(rows) >= 200}
            if error:
                evidence['error'] = error
            entry['lookup']['secondary'] = evidence
            if genre:
                entry.update(genre=genre, confidence='inferred', evidence='iTunes primary genre from exact artist/title match.' if method == 'exact-track' else 'Broad artist-context inference from a unique exact artist name in the returned iTunes catalog; not recording verification.')
                entry.pop('classificationStatus', None)
                entry['provenance'].update(method='itunes-' + method, confidence='inferred', confidenceLevel='medium', classifiedAt=now(),
                    referenceUrls=list(dict.fromkeys(row.get('trackViewUrl') or row.get('artistViewUrl') for row in matches if row.get('trackViewUrl') or row.get('artistViewUrl')))[:5])
        finalize(args, entries, source)
        print(f'Secondary artist lookup {index + 1}/{len(artists)}', flush=True)
    report = finalize(args, entries, source)
    return 0 if report['complete'] else 2


def finalize(args, entries, source):
    source_by_id = {identity(row): row for row in source}
    for entry in entries:
        original = source_by_id[identity(entry)]
        if isinstance(original.get('size'), int):
            entry['sourceBytes'] = original['size']
            if original['size'] <= 32:
                entry['resourceStatus'] = 'deleted' if norm(entry['title']) == 'deleted' else 'tiny-payload'
    entries.sort(key=identity)
    statuses = collections.Counter(row.get('lookup', {}).get('status', 'pending') for row in entries)
    unresolved = [row for row in entries if norm(row['genre']) == 'uncategorized']
    report = {'at': now(), 'total': len(entries), 'classified': len(entries) - len(unresolved),
              'uncategorized': len(unresolved), 'tinyPayloadResources': sum(row.get('sourceBytes', 33) <= 32 for row in entries), 'missingTitle': sum('title' in row['missingMetadataFields'] for row in entries),
              'missingArtist': sum('artist' in row['missingMetadataFields'] for row in entries),
              'lookupStatuses': dict(statuses), 'genres': dict(collections.Counter(row['genre'] for row in entries)),
              'methods': dict(collections.Counter(row.get('provenance', {}).get('method', 'unclassified') for row in entries)),
              'secondaryErrors': sum(row.get('lookup', {}).get('secondary', {}).get('status') == 'error' for row in entries),
              'artistFallbackErrors': sum(row.get('lookup', {}).get('artistFallback', {}).get('status') == 'error' for row in entries),
              'providerLimitedLookups': sum(bool(row.get('lookup', {}).get('providerResultLimited')) for row in entries),
              'lookupFinished': not (statuses['error'] or statuses['pending']),
              'complete': not unresolved and not statuses['error'] and not statuses['pending'] and not statuses['missing-identity'],
              'scope': 'All source AUDIO identities', 'excludesNodeBlockedNames': args.exclude_blocked}
    report['lookupFinished'] = report['lookupFinished'] and not report['artistFallbackErrors'] and not report['secondaryErrors']
    report['complete'] = report['complete'] and report['lookupFinished']
    document = {'schema': 'earbump.legacy-genres.v1', 'updatedAt': now(), 'revision': args.revision,
                'dataset': {'count': len(entries), 'sourceSha256': hashlib.sha256(Path(args.source).read_bytes()).hexdigest(),
                            'identifierPrefix': args.prefix, 'excludesNodeBlockedNames': args.exclude_blocked},
                'classificationPolicy': {'confidence': 'Native genre > exact-recording community tags > preserved editorial inference > Uncategorized. No acoustic verification.'},
                'summary': report, 'songs': entries}
    output = Path(args.output)
    write(output / 'genres.json', document)
    write(output / 'coverage.json', report)
    write(output / 'review-needed.json', [{'name': row['name'], 'identifier': row['identifier'],
          'artist': row['artist'], 'title': row['title'], 'genre': row['genre'], 'lookup': row.get('lookup', {'status': 'pending'})}
          for row in entries if norm(row['genre']) == 'uncategorized' or row.get('lookup', {}).get('status') in ('error', 'pending', 'missing-identity')])
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['pull', 'enrich', 'artists', 'secondary'])
    parser.add_argument('--core', default='https://api.qortal.org')
    parser.add_argument('--prefix', default='earbump_song_')
    parser.add_argument('--exclude-blocked', action='store_true', help='Optional explicit narrower scope; default includes all identities')
    parser.add_argument('--metadata-seed', default='data/legacy/source-2026-11-20.json')
    parser.add_argument('--source', default='data/legacy/source-current.json')
    parser.add_argument('--baseline', default='data/legacy/genres-2026-11-20.json')
    parser.add_argument('--output', default='data/legacy/current')
    parser.add_argument('--cache', default='.cache/catalog')
    parser.add_argument('--revision', default='2026-11-21.1')
    parser.add_argument('--batch-size', type=int, default=20)
    args = parser.parse_args()
    if not 1 <= args.batch_size <= 20:
        parser.error('--batch-size must be between 1 and 20')
    client = Client(args.cache, interval=3.1 if args.action == 'secondary' else 1.1)
    if args.action == 'pull':
        pull(args, client)
        return 0
    if args.action == 'secondary':
        return enrich_secondary(args, client)
    if args.action == 'artists':
        return enrich_artists(args, client)
    return enrich(args, client)


if __name__ == '__main__':
    raise SystemExit(main())
