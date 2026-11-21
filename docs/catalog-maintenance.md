# Maintaining the legacy song catalog

Run from the repository root with Python 3; no API key or audio download is needed.
`python3 scripts/catalog.py refresh` runs the entire inventory and enrichment
workflow. The individual resumable stages and verification commands are:

```sh
python3 scripts/catalog.py pull
python3 scripts/catalog.py enrich
python3 scripts/catalog.py artists
python3 scripts/catalog.py secondary
python3 scripts/catalog.py review
python3 -m unittest discover -s tests -p 'test_*.py'
node --test tests/song-metadata.test.mjs
npm run build
```

`pull` paginates until an empty page, advances by actual page size, rejects
repeated identities, and checks identities/signatures against a second scan.
It includes all publishers by default, including the 15 identities hidden by
the previous node block filter. `--exclude-blocked` explicitly requests the
narrower discovery scope. The app still respects the serving node's policy.
Original metadata recovered on an earlier run may be reused only when its QDN
transaction signature matches. Missing publisher metadata is retried and logged. New `earbump1` resources also
hydrate their full DOCUMENT after validating publisher, audio identity, schema
and revision, recovering compact-description truncation. A serving Core is
required for these documents; unavailable documents remain explicit failures in
the pull report and compact fields are retained.
The source list is atomically replaced only after both inventories agree.
`data/legacy/current/pull-report.json` records the exact scope and source hash.
No fixed expected count, first-page cutoff, cron, or scheduled publishing exists.

`enrich` checks every available artist/title pair through batched MusicBrainz
recording searches. Source enumeration has no record cap. Genre searches use the highest-ranked
100 recording candidates and explicitly record `providerResultLimited` when
more exist. Unmatched pairs are queried again in smaller groups, so a popular
song with hundreds of live versions cannot hide another song. This is genre
evidence retrieval, not a complete inventory of every MusicBrainz recording.
Other bounded searches are paginated against the API count and split when they
hit the provider limit.
Only normalized exact artist/title matches qualify; multiple matching artist
identities remain ambiguous. Candidate tags must belong to MusicBrainz's genre
registry and have positive votes; tied leading genres are left unresolved.
An exact recording's linked artist may provide a separately labelled broad
artist inference when recording tags are missing. Publisher genres win.
Existing editorial inferences remain explicitly inferred if no better evidence
is available; they are not upgraded to verified genres.
`artists` then searches unresolved artists in batches. A unique exact artist
name with positive genre tags may supply an explicitly labelled broad inference;
homonyms and untagged artists remain unresolved. This fallback does not claim
recording-specific verification.
`secondary` checks remaining identified artists against iTunes at least 3.1 seconds
between calls (under Apple's approximate 20/minute limit). Exact artist/title
matches can supply a catalog genre. A unique artist ID in a non-capped response
may supply a separately labelled artist-context inference only when at least
80% of matching catalog results share the genre. Featured-artist suffixes and
reordered collaboration credits are matched explicitly, so a newer rock single
does not relabel an older rap recording merely through artist context. Homonyms, tied genres
and capped artist-context searches remain unresolved. Only factual metadata and
source links are retained, never artwork or preview audio. Provider guidance:
https://performance-partners.apple.com/search-api.

MusicBrainz requests share a limiter (at least 1.1 seconds apart), a meaningful
User-Agent, bounded retries/backoff and Retry-After support. Successful responses
are cached in ignored `.cache/catalog/`; rerun after interruptions to reuse them.
HTTP/search errors are never negative-cached. Remove specific cached responses
or use a fresh `--cache` directory when refreshing successful historical results.
Do not run concurrent enrichment jobs from the same IP.
API guidance: https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting
and https://musicbrainz.org/doc/MusicBrainz_API/Search.

Each batch writes an atomic checkpoint. A rerun resumes completed per-song lookups
only when revision, source transaction signature, artist and title still match.
Rejected or unstable search batches are split so one query cannot hide other songs.
Repeated search results are deduplicated; interrupted HTTP bodies are retried. `genres.json` contains every source
identity and per-song lookup evidence; `coverage.json` reports statuses and
coverage; `review-needed.json` lists unresolved records. Exit status **2** means
coverage is incomplete or lookups failed. This is an intentional quality gate,
not a successful complete-coverage claim. `lookupFinished` describes attempted
searches, while `complete` also requires real genres and known artist/title.
Do not relabel Uncategorized as a genre or invent artist/title data to pass it.
Review missing/ambiguous identities with the publisher, correct source metadata,
and rerun. No provider can promise a factual genre for an unidentified recording.

`review` fills remaining gaps from `data/legacy/reviews.json`, retaining citations
and inferred confidence. Reviews bind the exact QDN identity, original signature,
artist and title. Stale reviews are flagged; existing native or catalog genres
are preserved. The current review file covers researched artist/album context,
not acoustic identification. Add reviewed evidence here rather than editing the
generated snapshot or expanding an untraceable hardcoded artist map.

## App consumption and publication

The 2026-11-21 delivery worktree is
`/home/crowetic/git-repos/ear-bump-delivery-20261121`, based on committed main.
The canonical `/home/crowetic/git-repos/ear-bump` checkout retains 59 pre-existing
uncommitted source paths (including Phase 3 UI work). Yesterday's QDN app was
built from that dirty source. Reconcile and review those edits before a new QDN
app release if retaining the already-published Phase 3 interface; this task did
not sweep unrelated UI changes into its commits or deploy a replacement app.


Genre discovery scans all supported AUDIO prefixes, progressively hydrates full
metadata, and displays 60 local rows at a time. Native genres take priority over
the trusted legacy index. New public uploads require title, artist and genre,
and publish a revision-linked `earbump.song.v1` DOCUMENT alongside AUDIO and
THUMBNAIL, so missing legacy genres are not recreated by new app uploads. A lazy bundled JSON chunk provides the reviewed
snapshot without depending on an environment variable or QDN availability.
The app bundle and browser cache retain only consumed metadata, avoiding the
full audit payload and its storage cost. `app-genres.json` is generated from the
full snapshot and verified to contain identical normalized metadata. The default trusted QDN publisher is the previously verified `crodex`; overrides
are documented in `.env.example`. Valid cached/remote and bundled documents are
compared by `updatedAt`, so yesterday's 24-hour cache cannot hide a newer bundle.
An invalid or offline remote falls back to the bundled snapshot.

Git publication of the complete source/data snapshot is the delivery mechanism
for this task. It does not replace yesterday's APP/crodex publication. For a
future QDN release, build the exact pushed commit, review coverage, publish a
new unused DOCUMENT revision first, verify its hash and confirmed transaction,
then publish the same full JSON to `earbump_legacy_genres_v1`. The stable master
must contain the full document, not a pointer. Keep previous revision resources.
Publish a ZIP with `dist/index.html` at the archive root to APP/crodex/default,
then verify confirmation, READY and served hashes. Use the established Qortal
MCP publishing workflow and the owner's authorized wallet; never store keys or
wallet unlock material in this repo. Reverting source alone does not roll back
QDN: republish the previous approved app ZIP or a corrected genre revision.
