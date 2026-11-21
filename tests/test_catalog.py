import importlib.util
import unittest
from unittest.mock import patch
import http.client
import json
import tempfile
import types
import urllib.error
from pathlib import Path

spec = importlib.util.spec_from_file_location('catalog', Path(__file__).parents[1] / 'scripts/catalog.py')
catalog = importlib.util.module_from_spec(spec)
spec.loader.exec_module(catalog)


class FakeClient:
    def __init__(self, pages):
        self.pages = iter(pages)
        self.urls = []

    def get(self, url, **kwargs):
        self.urls.append(url)
        return next(self.pages)


def row(identifier):
    return {'name': 'Publisher', 'service': 'AUDIO', 'identifier': 'earbump_song_' + identifier}


class CatalogTests(unittest.TestCase):
    def test_short_pages_are_not_treated_as_end(self):
        client = FakeClient([[row('a')], [row('b')], []])
        self.assertEqual(len(catalog.scan(client, 'https://example.test', 'earbump_song_')), 2)
        self.assertIn('offset=1', client.urls[1])
        self.assertIn('offset=2', client.urls[2])

    def test_repeated_qdn_page_fails_instead_of_truncating(self):
        with self.assertRaisesRegex(ValueError, 'Repeated QDN'):
            catalog.scan(FakeClient([[row('a')], [row('a')]]), 'https://example.test', 'earbump_song_')

    def test_musicbrainz_search_exhausts_reported_count(self):
        client = FakeClient([{'count': 2, 'recordings': [{'id': 'a'}]}, {'count': 2, 'recordings': [{'id': 'b'}]}])
        self.assertEqual(len(catalog.search(client, 'recording', 'example')), 2)
        self.assertIn('offset=1', client.urls[1])

    def test_musicbrainz_score_ties_do_not_abort_search(self):
        client = FakeClient([{'count': 3, 'recordings': [{'id': 'a'}, {'id': 'b'}]}, {'count': 3, 'recordings': [{'id': 'b'}]}])
        self.assertEqual(len(catalog.search(client, 'recording', 'example')), 2)
        self.assertIn('offset=2', client.urls[1])

    def test_musicbrainz_premature_empty_page_is_failure(self):
        client = FakeClient([{'count': 2, 'recordings': [{'id': 'a'}]}, {'count': 2, 'recordings': []}])
        with self.assertRaisesRegex(ValueError, 'before reported total'):
            catalog.search(client, 'recording', 'example')

    def test_exact_artist_and_title_required(self):
        recording = {'id': 'a', 'title': 'Song', 'artist-credit': [{'name': 'Artist'}]}
        self.assertEqual(catalog.matching_recordings([recording], 'Artist', 'song'), [recording])
        self.assertEqual(catalog.matching_recordings([recording], 'Other Artist', 'Song'), [])
        self.assertEqual(catalog.matching_recordings([recording], 'Artist', 'Song (remix)'), [])

    def test_non_genre_tags_and_tied_genres_do_not_become_assignments(self):
        self.assertIsNone(catalog.choose_genre([{'tags': [{'name': 'american', 'count': 5}]}], {'rock'}))
        self.assertIsNone(catalog.choose_genre([{'tags': [{'name': 'rock', 'count': 2}, {'name': 'pop', 'count': 2}]}], {'rock', 'pop'}))
        self.assertEqual(catalog.choose_genre([{'tags': [{'name': 'rock', 'count': 3}]}], {'rock'}), 'rock')

    def test_confidence_labels_remain_consistent_with_classification(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = [{**row(str(i)), 'created': 1000} for i in range(3)]
            catalog.write(root / 'source.json', source)
            entries = [{**item, 'title': 'One', 'artist': 'Artist', 'genre': genre, 'confidence': confidence,
                        'missingMetadataFields': [], 'provenance': {'confidenceLevel': level}, 'lookup': {'status': 'no-exact-match'}}
                       for item, genre, confidence, level in zip(source, ['Uncategorized', 'Rock', 'Jazz'], ['inferred', 'inferred', 'verified'], ['medium', 'none', 'none'])]
            args = types.SimpleNamespace(source=str(root / 'source.json'), output=str(root / 'output'), revision='test', prefix='earbump_song_', exclude_blocked=False)
            catalog.finalize(args, entries, source)
            self.assertEqual([entry['provenance']['confidenceLevel'] for entry in entries], ['none', 'medium', 'high'])
            self.assertNotIn('confidence', entries[0])

    def test_stale_source_signature_cannot_be_published_as_current(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = [{**row('a'), 'created': 1000, 'latestSignature': 'current'}]
            catalog.write(root / 'source.json', source)
            entries = [{**source[0], 'title': 'One', 'artist': 'Artist', 'genre': 'Rock', 'missingMetadataFields': [],
                        'provenance': {'sourceSignature': 'stale'}, 'lookup': {'status': 'matched-genre'}}]
            args = types.SimpleNamespace(source=str(root / 'source.json'), output=str(root / 'output'), revision='test', prefix='earbump_song_', exclude_blocked=False)
            with self.assertRaisesRegex(ValueError, 'signature is stale'):
                catalog.finalize(args, entries, source)
            self.assertFalse((root / 'output/genres.json').exists())

    def test_reviews_fill_only_matching_unresolved_source_and_preserve_native_genres(self):
        for genre, signature, expected in [('Uncategorized', 'same', 'Rock'), ('Jazz', 'same', 'Jazz'), ('Uncategorized', 'changed', 'Uncategorized')]:
            with self.subTest(genre=genre, signature=signature), tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                source = [{'name': 'Publisher', 'service': 'AUDIO', 'identifier': 'earbump_song_a', 'created': 1000}]
                catalog.write(root / 'source.json', source)
                entry = {**source[0], 'title': 'One', 'artist': 'Artist', 'genre': genre, 'missingMetadataFields': [], 'provenance': {'sourceSignature': signature}, 'lookup': {'status': 'no-exact-match'}}
                catalog.write(root / 'output/genres.json', {'songs': [entry]})
                review = {**source[0], 'title': 'One', 'artist': 'Artist', 'genre': 'Rock', 'sourceSignature': 'same', 'evidence': 'Reviewed artist context.', 'referenceUrls': ['https://example.test/artist']}
                catalog.write(root / 'reviews.json', {'schema': 'earbump.genre-reviews.v1', 'songs': [review]})
                args = types.SimpleNamespace(source=str(root / 'source.json'), output=str(root / 'output'), reviews=str(root / 'reviews.json'), revision='test', prefix='earbump_song_', exclude_blocked=False)
                catalog.apply_reviews(args)
                result = json.loads((root / 'output/genres.json').read_text())['songs'][0]
                self.assertEqual(result['genre'], expected)
                if signature == 'changed':
                    self.assertEqual(result['lookup']['review']['status'], 'stale-source')

    def test_secondary_provider_requires_exact_names_and_rejects_homonyms(self):
        rows = [{'artistId': 1, 'artistName': 'Artist', 'trackName': 'Song', 'primaryGenreName': 'Rock'}]
        self.assertEqual(catalog.apple_genre(rows, 'Artist', 'song', False)[0], 'Rock')
        self.assertIsNone(catalog.apple_genre(rows, 'Different', 'Song', False)[0])
        self.assertIsNone(catalog.apple_genre(rows + [{**rows[0], 'artistId': 2}], 'Artist', 'Song', False)[0])

    def test_featured_artist_credit_and_multistyle_catalogs_are_handled(self):
        rows = [{'artistId': 1, 'artistName': 'First', 'trackName': 'Song (feat. Second)', 'primaryGenreName': 'Hip-Hop/Rap'}]
        self.assertEqual(catalog.apple_genre(rows, 'Second & First', 'Song', False)[0], 'Hip-Hop/Rap')
        self.assertIsNone(catalog.apple_genre(rows, 'First & Different', 'Song', False)[0])
        mixed = [{'artistId': 1, 'artistName': 'Artist', 'trackName': 'One', 'primaryGenreName': 'Rock'}, {'artistId': 1, 'artistName': 'Artist', 'trackName': 'Two', 'primaryGenreName': 'Pop'}]
        self.assertIsNone(catalog.apple_genre(mixed, 'Artist', 'Other', False)[0])

    def test_limited_secondary_catalog_does_not_establish_artist_context(self):
        rows = [{'artistId': 1, 'artistName': 'Artist', 'trackName': 'Other song', 'primaryGenreName': 'Rock'}]
        self.assertIsNone(catalog.apple_genre(rows, 'Artist', 'Song', True)[0])
        self.assertEqual(catalog.apple_genre(rows, 'Artist', 'Song', False)[2], 'artist-context')

    def test_large_version_catalog_cannot_hide_another_song(self):
        first = {'id': 'a', 'title': 'One', 'artist-credit': [{'name': 'Artist'}]}
        second = {'id': 'b', 'title': 'Two', 'artist-credit': [{'name': 'Artist'}]}
        client = FakeClient([{'count': 900, 'recordings': [first]}, {'count': 1, 'recordings': [second]}])
        results = catalog.recording_results(client, [('Artist', 'One'), ('Artist', 'Two')])
        self.assertTrue(results[('Artist', 'One')][0][0]['_providerResultLimited'])
        self.assertEqual(results[('Artist', 'Two')][0], [second])
        self.assertEqual(len(client.urls), 2)

    def test_artist_fallback_requires_unique_exact_name(self):
        for ambiguous in [False, True]:
            with self.subTest(ambiguous=ambiguous), tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                source = [{'name': 'Publisher', 'service': 'AUDIO', 'identifier': 'earbump_song_a', 'created': 1000}]
                catalog.write(root / 'source.json', source)
                entry = {**source[0], 'title': 'One', 'artist': 'Artist', 'genre': 'Uncategorized', 'missingMetadataFields': [], 'provenance': {}, 'lookup': {'status': 'no-exact-match'}}
                catalog.write(root / 'output/genres.json', {'songs': [entry]})
                rows = [{'id': 'a', 'name': 'Artist', 'tags': [{'name': 'rock', 'count': 3}]}]
                if ambiguous:
                    rows.append({'id': 'b', 'name': 'Artist', 'tags': [{'name': 'pop', 'count': 4}]})
                client = FakeClient([{'genre-count': 2, 'genres': [{'name': 'rock'}, {'name': 'pop'}]}, {'count': len(rows), 'artists': rows}])
                args = types.SimpleNamespace(source=str(root / 'source.json'), output=str(root / 'output'), revision='test', prefix='earbump_song_', exclude_blocked=False)
                catalog.enrich_artists(args, client)
                result = json.loads((root / 'output/genres.json').read_text())['songs'][0]
                self.assertEqual(result['genre'], 'Uncategorized' if ambiguous else 'rock')

    def test_rejected_batch_splits_without_losing_other_tracks(self):
        class RejectLargeBatch:
            def __init__(self):
                self.urls = []

            def get(self, address, **kwargs):
                self.urls.append(address)
                if '+OR+' in address:
                    raise urllib.error.HTTPError(address, 400, 'query limit', {}, None)
                return {'count': 0, 'recordings': []}

        client = RejectLargeBatch()
        pairs = [('Artist', 'One'), ('Artist', 'Two')]
        results = catalog.recording_results(client, pairs)
        self.assertEqual(set(results), set(pairs))
        self.assertTrue(all(error is None for rows, error in results.values()))
        self.assertEqual(len(client.urls), 3)

    def test_interrupted_body_is_retried_before_caching(self):
        class Response:
            def __enter__(self):
                return self

            def __exit__(self, *args):
                pass

            def read(self, size=-1):
                return b'{"ok":true}'

        with tempfile.TemporaryDirectory() as temporary:
            with patch.object(catalog.urllib.request, 'urlopen', side_effect=[http.client.IncompleteRead(b'partial'), Response()]) as request:
                with patch.object(catalog.time, 'sleep'):
                    value = catalog.Client(temporary).get('https://example.test/data')
            self.assertEqual(value, {'ok': True})
            self.assertEqual(request.call_count, 2)
            self.assertEqual(len(list(Path(temporary).glob('*.json'))), 1)

    def test_checkpoint_resumes_only_matching_source_signature(self):
        for signature, expected_queries in [('same', False), ('changed', True)]:
            with self.subTest(signature=signature), tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                source = [{'name': 'Publisher', 'service': 'AUDIO', 'identifier': 'earbump_song_a', 'created': 1000, 'latestSignature': signature,
                           'metadata': {'title': 'One', 'description': 'author=Artist'}}]
                catalog.write(root / 'source.json', source)
                catalog.write(root / 'baseline.json', {'songs': []})
                catalog.write(root / 'output/genres.json', {'revision': 'test', 'songs': [{**source[0], 'title': 'One', 'artist': 'Artist', 'genre': 'Rock',
                    'provenance': {'sourceSignature': 'same'}, 'lookup': {'status': 'matched-genre', 'artist': 'Artist', 'title': 'One'}}]})
                args = types.SimpleNamespace(source=str(root / 'source.json'), baseline=str(root / 'baseline.json'), output=str(root / 'output'), revision='test', prefix='earbump_song_', exclude_blocked=False, batch_size=20)
                client = FakeClient([{'genre-count': 1, 'genres': [{'name': 'rock'}]}] + ([{'count': 0, 'recordings': []}] if expected_queries else []))
                catalog.enrich(args, client)
                self.assertEqual(any('/recording?' in address for address in client.urls), expected_queries)
                report = json.loads((root / 'output/coverage.json').read_text())
                self.assertEqual(report['total'], 1)
                self.assertNotIn('pending', report['lookupStatuses'])

    def test_full_descriptor_recovers_compact_artist_and_checks_identity(self):
        song = {'name': 'Publisher', 'service': 'AUDIO', 'identifier': 'earbump_song_a', 'metadata': {'title': 'Short', 'description': 'v=earbump1;rev=a;author=Truncated;genre=Rock'}}
        descriptor = {'schema': 'earbump.song.v1', 'publisher': 'Publisher', 'identifier': 'earbump_song_a', 'revision': 'a', 'fields': {'title': 'Full song', 'artist': 'Complete Artist', 'genre': 'Jazz'}}
        catalog.hydrate_descriptor(FakeClient([descriptor]), 'https://example.test', song)
        self.assertEqual(catalog.fields(song)['artist'], 'Complete Artist')
        self.assertEqual(catalog.fields(song)['genre'], 'Jazz')
        original = {'name': 'Publisher', 'service': 'AUDIO', 'identifier': 'earbump_song_a', 'metadata': {'description': 'v=earbump1;rev=a;genre=Rock'}}
        with self.assertRaisesRegex(ValueError, 'does not match'):
            catalog.hydrate_descriptor(FakeClient([{**descriptor, 'publisher': 'Other'}]), 'https://example.test', original)
        self.assertNotIn('descriptorEvidence', original)
        for malformed in [None, [], {**descriptor, 'publisher': None}]:
            with self.assertRaisesRegex(ValueError, 'does not match'):
                catalog.hydrate_descriptor(FakeClient([malformed]), 'https://example.test', original)

    def test_encoded_descriptions_preserve_artist(self):
        self.assertEqual(catalog.fields({'metadata': {'description': 'v=2;author=Bj%C3%B6rk;genre=Art%20Pop'}})['author'], 'Björk')


if __name__ == '__main__':
    unittest.main()
