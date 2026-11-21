# Music catalog, metadata and legacy classification

Current delivery results and source scope are in `song-data-results.md`; repeatable
refresh and publication instructions are in `catalog-maintenance.md`. Historical
Q-Music observations below are explicitly dated 2026-11-20.

## Verified Q-Music publishing format (2026-11-20)

Research used read-only Qortal MCP `node_proxy` calls, including the live APP
`Q-Music` index and its referenced JavaScript modules. The app identifies itself
as **Q-Music 2.0.2-rc.6**. No separate registry was required: its feed directly
searches AUDIO resources by identifier prefix.

| Property | Existing ear-bump | Current Q-Music | New ear-bump |
| --- | --- | --- | --- |
| Audio | `AUDIO/<publisher>/earbump_song_<slug>_<id>` | `AUDIO/<publisher>/enjoymusic_song_<slug>_<id>` | Existing AUDIO convention retained |
| Cover | THUMBNAIL, same publisher and identifier | THUMBNAIL, same publisher and identifier, optional | Same THUMBNAIL convention |
| Search title | QDN metadata title and legacy `title=` | QDN metadata title | QDN metadata title |
| Artist | Legacy `author=` | `author=` (older tracks sometimes `artist=`) | Structured `artist`/`author`, compact `author=` |
| Genre | Only 2 of 3,407 in previous survey | Optional `genre=`; 14 of 32 current-prefix songs observed | Required upload field, structured `genre` plus compact `genre=` |
| Album and discovery | Mostly absent | Optional album, genre, mood, language, notes, publishedDate | Album, genre, mood, BPM, duration, releaseDate, explicit, tags, description |
| Full metadata | No per-song JSON in the surveyed format | Revision-linked `DOCUMENT` with `qmusic.song.v2` schema | Revision-linked `DOCUMENT` with `earbump.song.v1` schema |
| Audio hash | QDN locator, no app-level hash field | v2 document has SHA-256, bytes, filename, MIME type | QDN locator, bytes, filename, MIME type; optional SHA-256 supported |

There were also **2 historical `qmusic_track_*` AUDIO resources**, whose compact
metadata uses `artist=`. These are included. Earlier `qmusic_audio_*` and
`qmusic_song_*` entries seen during discovery were 32-byte artifacts; the current
Q-Music feed does not query them. They are not treated as playable songs.

Example current locator:
`qortal://AUDIO/Q-Music/enjoymusic_song_test_song_75f32b36`.
Its compact metadata was:

```text
v=2;rev=b3f41e897aca4501;author=Artist%20test;publishedDate=2026-11-20;genre=Trap;language=Kodukeel;album=No%20albumit;mood=Mood%20puudub
```

Full details are at
`qortal://DOCUMENT/Q-Music/qmusic_meta_enjoymusic_song_test_song_75f32b36`:

```json
{
  "schema": "qmusic.song.v2",
  "publisher": "Q-Music",
  "identifier": "enjoymusic_song_test_song_75f32b36",
  "revision": "b3f41e897aca4501",
  "fields": {
    "title": "Test song",
    "author": "Artist test",
    "album": "No albumit",
    "genre": "Trap",
    "mood": "Mood puudub",
    "language": "Kodukeel",
    "notes": "Ei ole mingeid noote",
    "publishedDate": "2026-11-20"
  },
  "audio": {
    "sha256": "abc4fdf421a26a9a7444ca79118987f46545acf83e874694b90f10e82f41cb1b",
    "bytes": 828856,
    "filename": "test_song.mp3",
    "mimeType": "audio/mpeg"
  }
}
```

The full-document identifier is `qmusic_meta_<audio identifier>` if that fits
64 UTF-8 bytes. Otherwise it is `qmusic_meta_` plus the first 48 hexadecimal
characters of SHA-256 of the audio identifier. Both forms are supported.
The document must match publisher, audio identifier, schema and compact revision.
Q-Music URI-encodes compact v2 values; historical descriptions were plain text.
The adapter handles both and maps `publishedDate` to `releaseDate` and `author`
to `artist`. BPM, duration, explicit and tags were **not found in the current
Q-Music publisher's persisted field set**. Do not assume they exist or derive
BPM/duration from file size. Genre is not present on every Q-Music song.

Source modules inspected from `APP/Q-Music` using the Core `filepath` parameter:
`assets/songs-0WXvW9Px.js`, `assets/songMetadata-DHNSmrBF.js`,
`assets/songDescriptors-I4Dz4qrD.js`, `assets/useMediaPublish-CslVEO5F.js`,
`assets/publishLimits-o_5PxjBL.js`. Live resource responses and relevant source
are retained for this task in `/tmp/ear-bump-qmusic-evidence.json`.

## App behavior

Search and genre discovery query all three verified AUDIO prefixes. The search
request for each prefix has its own 20-resource offset; one source reaching the
end does not truncate the others. A metadata-only full scan (100 per page) is
shared for the app session, so genre filters cover older songs outside the first
search page. It progressively populates results and never downloads audio.
Large matching song lists render 60 rows at a time; Load more reveals the next
60 without filtering only the first page. Artist and album pages reuse the
discovered catalog after navigation. Existing
Home/newest publisher-specific feeds and ear-bump playlists retain their scope;
Q-Music playlist import is outside this song integration.

Per-song documents hydrate with four concurrent requests per discovery/search
worker and are cached by publisher, identifier and revision. Compact metadata
remains available if a document is missing, stale or malformed, with a partial
results message. Fetches use Core-relative encoded QDN locators. Covers are lazy
loaded with the existing placeholder on failure. The same AUDIO playback,
queue, likes and playlist paths consume either app's normalized songs.

Genre precedence is: **song's structured/compact genre, legacy entry genre,
Uncategorized**. A broad QDN category such as MUSIC and arbitrary tags do not
become a music genre. Genre matching ignores case and outer whitespace.
Text search also includes mood and tags. Results from both sources sort by
release date, falling back to original QDN publish time, never update time.
Track rows show source, genre, mood, BPM, duration, date and explicit flag when
available, plus tags. Optional fields are not invented. Native song metadata is
retained in history and newly created playlist references. Derived legacy fields
are tracked and re-resolved from the index, so a cached classification never
becomes a permanent publisher-provided genre or masks a later correction.

## New ear-bump songs

Core's AUDIO payload remains the binary audio file. Core transaction metadata
supports title, description, tags and category; arbitrary custom JSON fields
such as genre are not supported there. See the [Core metadata implementation](https://github.com/Qortal/qortal/blob/master/src/main/java/org/qortal/arbitrary/metadata/ArbitraryDataTransactionMetadata.java).

The upload publishes a resource group under one publisher and identifier:

1. AUDIO: binary file, title, compact `v=earbump1;rev=...;genre=...;releaseDate=...;author=...`.
2. DOCUMENT: JSON `earbump.song.v1` with publisher, identifier, matching revision,
   `fields` (title, artist, author, album, genre, mood, bpm, duration, releaseDate,
   explicit, tags, description), `audio` and `coverArt` QDN references.
3. THUMBNAIL: compressed WebP cover.

Genre lives on this per-song structured resource group and needs no legacy list
entry. A full JSON DOCUMENT avoids the Core description's 240-byte truncation.
Compact values are encoded without splitting escape sequences; oversize genres
are rejected. Duration is read from local audio metadata if the optional seconds
field is blank. A codec the browser cannot inspect may leave duration unknown.
Release date defaults to today's UTC date. Explicit false is preserved; unknown
explicit values on historical resources remain unknown. `vibe`/`tempo` are read
as aliases for canonical `mood`/`bpm`; publishers write the canonical fields.
`audio.sha256` and `coverArt.sha256` are supported optional hash fields; this
publisher does not calculate full-file hashes. Stable QDN locators identify the
assets. No QDN publishing or real wallet interaction was performed during this task.

## One-time legacy classification publish

The registered publisher **crodex** published the stable master
`DOCUMENT/crodex/earbump_legacy_genres_v1` on 2026-11-20. It contains the prior
3,407-resource snapshot. The current 3,422-resource dataset is published in Git;
its coverage and limits are documented in `song-data-results.md`. No newer QDN
DOCUMENT or APP was submitted by this task.

`VITE_LEGACY_GENRE_PUBLISHER` defaults to `crodex`; the optional identifier defaults
to `earbump_legacy_genres_v1`. The app also ships the reviewed snapshot in a lazy
bundle and compares validated cache/remote and bundled `updatedAt` values.
Native song metadata wins. QDN failure and blocked browser storage retain the
bundled genre data. A successful list is shared for the app session and cached
for 24 hours. The newer bundle takes precedence over stale cached classifications.
Future QDN publication must use an unused revision resource, then advance the
full master document after verification. A master pointer is not supported.

```json
{
  "schema": "earbump.legacy-genres.v1",
  "updatedAt": "2026-11-20T00:00:00Z",
  "songs": [
    {
      "name": "original-publisher-name",
      "service": "AUDIO",
      "identifier": "earbump_song_original_identifier",
      "title": "Original title",
      "artist": "Original artist",
      "genre": "Trance",
      "releaseDate": "2025-10-21",
      "confidence": "verified",
      "evidence": "Publisher description explicitly says genre=Trance"
    }
  ]
}
```

The schema requires the QDN identity, title, artist and genre. Use the full
`(service, publisher, identifier)` tuple, not title/artist alone; titles can
repeat. Publisher identity matching is case insensitive. Duplicate identities,
invalid documents or non-ear-bump entries are rejected. Supported optional
fields are album, duration (seconds), mood, BPM, releaseDate, explicit, tags,
trackNumber, discNumber, language and notes. Existing values always win over
classification fallback, including zero duration and explicit false.

Process every source identity, retaining explicit publisher genres. The earlier
3,407 count excluded node-blocked resources; current inventory includes 3,422.
Do not confuse a nonempty Uncategorized string with a genuine classification.
Use "Uncategorized" for uncertain cases instead of guessing. Keep provenance
and reviewer confidence per entry in the working dataset. Use `created` from
QDN as the **publish date fallback**, and distinguish it in the dataset from an
actual historical release date. Preserve the millisecond timestamp in `created`
for audit even if only an ISO date is displayed. Infer mood/tags cautiously from
explicit descriptive evidence. Do not infer BPM or explicit=false from names,
artists, silence or absent metadata. Prefer measured BPM and browser/audio
metadata for duration. Missing optional values should be omitted, not zeroed.
The app will not invent genres from artists or filenames.

The reviewed source/data snapshots, exhaustive pull tooling and evidence-backed
lookups are now tracked in Git. Remaining gaps are explicit in
`data/legacy/current/review-needed.json`. The app never invents BPM, artist/title
identity or genre to pass coverage checks. Q-Music metadata and genre filtering
remain active independently of the legacy publication.

## Verification

`node --test tests/song-metadata.test.mjs` exercises metadata precedence,
normalization, invalid values, URI decoding, legacy identity/cache/validation,
resource addressing, and descriptor revision validation. `npm run build`, lint
diagnostic comparison against the inherited working tree, whitespace checks and
mocked Chromium integration cover the implementation. Live discovery was read
only; actual QDN audio retrieval, multi-resource publication and wallet approval
still require an authorized environment. Source and data commits are pushed to the writable Crowetic fork. A new QDN
app release is separate; reconcile the preserved Phase 3 UI edits first, as
described in `catalog-maintenance.md`.
