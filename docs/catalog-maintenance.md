# Maintaining the legacy song catalog

Run from the repository root with Python 3; no API key or audio download is needed.

```sh
python3 scripts/catalog.py pull
python3 scripts/catalog.py enrich
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
transaction signature matches. Missing publisher metadata is retried and logged.
The source list is atomically replaced only after both inventories agree.
`data/legacy/current/pull-report.json` records the exact scope and source hash.
No fixed expected count, first-page cutoff, cron, or scheduled publishing exists.

`enrich` checks every available artist/title pair through batched MusicBrainz
recording searches. Results are exhaustively paginated against the API count.
Only normalized exact artist/title matches qualify; multiple matching artist
identities remain ambiguous. Candidate tags must belong to MusicBrainz's genre
registry and have positive votes; tied leading genres are left unresolved.
An exact recording's linked artist may provide a separately labelled broad
artist inference when recording tags are missing. Publisher genres win.
Existing editorial inferences remain explicitly inferred if no better evidence
is available; they are not magically upgraded to verified genres.

MusicBrainz requests share a limiter (at least 1.1 seconds apart), a meaningful
User-Agent, bounded retries/backoff and Retry-After support. Successful responses
are cached in ignored `.cache/catalog/`; rerun after interruptions to reuse them.
HTTP/search errors are never negative-cached. Remove specific cached responses
or use a fresh `--cache` directory when refreshing successful historical results.
Do not run concurrent enrichment jobs from the same IP.
API guidance: https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting
and https://musicbrainz.org/doc/MusicBrainz_API/Search.

Each batch writes an atomic checkpoint. `genres.json` contains every source
identity and per-song lookup evidence; `coverage.json` reports statuses and
coverage; `review-needed.json` lists unresolved records. Exit status **2** means
coverage is incomplete or lookups failed. This is an intentional quality gate,
not a successful complete-coverage claim. `lookupFinished` describes attempted
searches, while `complete` also requires real genres and known artist/title.
Do not relabel Uncategorized as a genre or invent artist/title data to pass it.
Review missing/ambiguous identities with the publisher, correct source metadata,
and rerun. No provider can promise a factual genre for an unidentified recording.

## App consumption and publication

Genre discovery scans all supported AUDIO prefixes, progressively hydrates full
metadata, and displays 60 local rows at a time. Native genres take priority over
the trusted legacy index. A lazy bundled JSON chunk provides the reviewed
snapshot without depending on an environment variable or QDN availability.
The default trusted QDN publisher is the previously verified `crodex`; overrides
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
