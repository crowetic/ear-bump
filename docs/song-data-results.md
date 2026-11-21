# Song data delivery results — 2026-11-21

Canonical source checkout: `/home/crowetic/git-repos/ear-bump`.
Delivery worktree: `/home/crowetic/git-repos/ear-bump-delivery-20261121`.
Writable remote: `https://github.com/crowetic/ear-bump.git`, branch `main`.
Upstream reference remains `/home/crowetic/git-repos/Q-Apps-code/ear-bump`.
The original 403 source/generated-graph file hashes are unchanged; its 59
pre-existing source paths remain uncommitted and were not swept into delivery.

## Before and after

The list is a JSON document with a `songs` array keyed by service, publisher and
identifier, not an audio download or a playlist. Every row retains artist/title,
genre, original QDN publish time/signature, classification method and evidence.

| Metric | Previous published list | New Git snapshot |
| --- | ---: | ---: |
| Source resource rows | 3,407 | 3,422 |
| Nonempty genre strings | 3,407 | 3,422 |
| Empty/missing genre strings | 0 | 0 |
| Assigned genres | 2,545 (74.70%) | 2,883 (84.25%) |
| Uncategorized | 862 | 539 |
| Publisher-provided genre | 2 | 3 |
| Inferred genre | 2,543 | 2,880 |
| Missing title placeholders | 35 | 42 |
| Missing artist placeholders | 38 | 45 |

The new snapshot adds the 15 identities excluded by the old node block filter.
It contains 84 distinct non-Uncategorized genre labels (case insensitive).
There are 3,377 rows with artist/title strings and 3,281 distinct searchable pairs.
All usable pairs were searched; no pending lookups or request errors remain.
3,403 resource rows have usable source metadata; 19 metadata retrievals were
unavailable or unusable (18 HTTP 404, one no title/description).

**Genre enrichment remains incomplete:** 539 rows require review.
Nonempty Uncategorized strings are not counted as classifications. Of all
resources, 39 are at most 32 bytes, including two explicitly deleted entries.
Missing identities, artist homonyms, malformed/ambiguous source names and absent
catalog genres are retained as gaps. Unknown artist/title and BPM values were not filled with guesses. Genre
inferences retain explicit confidence and evidence.
Publisher-provided means explicit source metadata, not acoustic verification.
The other 2,880 classifications remain labelled inferred.

## Actual files and samples

- `data/legacy/source-current.json`: 1,196,854 bytes, 3,422 source resources.
- `data/legacy/current/genres.json`: 5,087,662 bytes, 3,422 output rows.
- `data/legacy/current/app-genres.json`: 657,946 bytes; all 3,422 rows and identical consumed metadata, without audit-only payloads.
- `data/legacy/current/coverage.json`: full genre/method/status counts.
- `data/legacy/current/review-needed.json`: unresolved rows with lookup outcomes.
- `data/legacy/current/validation.json`: identity, hash and timestamp verification.
- `data/legacy/reviews.json`: cited, signature-bound review entries.
- `data/legacy/*2026-11-20.json`: original snapshots for audit comparisons.

| Artist | Title | Genre | Method |
| --- | --- | --- | --- |
| Disturbed | Avarice | heavy metal | musicbrainz-recording-tags |
| Louis Armstrong | Blueberry Hill | jazz | musicbrainz-recording-tags |
| Lauren Cruz | Can't Resist | Pop | itunes-artist-context |
| Animal Boys | Animal Boy | Punk Rock | reviewed-artist-context |
| The Pholosopher & Jack Lloyd | Agorist Nexus | Hip-Hop/Rap | itunes-exact-track |
| Unknown artist | Unknown title | Uncategorized | missing identity |

Source SHA-256: `fe93c7bfc7c09c8cd8d3c5de94d2ccecfd8ae1ac957d6c5cb88605b08d98c542`.
Genre SHA-256: `2ae4c4f3aa222a62c50f69c1fd137d21364df48c1a4ac60429c508c9504e89ef`.
All 3,422 unique source identities, timestamps and signatures match.

## What changed

The old workstation-only script used a fixed artist map and asserted 3,407 rows.
The new `scripts/catalog.py refresh` enumerates every matching AUDIO resource
through an empty page, verifies a second inventory, recovers metadata and runs
resumable recording, artist, secondary-catalog and cited-review stages. There is
no fixed source count or first-page cutoff. Searchable identities include every
publisher by default; app discovery retains the serving node's block policy.

MusicBrainz genre evidence is restricted to its genre registry. iTunes uses
catalog genres, exact artist/title and featured-credit matching, with conservative
artist context only for a consistent uncapped catalog. Neither transfers audio.
Rate limits, retries, interrupted-body recovery, cache/checkpoints and explicit
provider caps are implemented. Recording candidate limits affected
287 rows; artist-search limits affected
16 rows. These flags are retained rather than
silently claiming exhaustive provider discographies. Exit status 2 records
incomplete genre coverage; it is not a complete-coverage success signal.

Ordinary app builds now load the newer validated bundled genre snapshot when
QDN is offline, configuration is absent or cached remote data is stale. Native
publisher metadata wins. Search scans the full catalog and renders incrementally.
New public uploads require artist, title and genre and publish full structured
metadata alongside audio, retaining genre in the compact description.

## Publication and app work

The original QDN master was independently read through MCP during this audit:
revision `2026-11-20.1`, 3,407 rows, 2,545 classifications and 862 Uncategorized.
APP/crodex reports READY (3/3 chunks). The new source and dataset are published
through Git; **no new QDN DOCUMENT/APP or service deployment was submitted**.
Direct public api.qortal.org DOCUMENT retrieval returned HTTP 403; the configured
MCP Core served the document. The bundled fallback removes this availability
requirement from ordinary builds.

Private Collections now has a plan, typed collection/tier/entitlement models,
access-policy evaluator and disabled gateway, plus a Home Coming Soon card and
`/private-collections` explanation. Encryption/payment/playback adapters remain
future work; no subscription or private publication is active. See
`private-collections.md` for release gates.

The app is version 0.1.0. A small top-left tag on every route links to
`/changelog`, which renders the root `CHANGELOG.md`. `AGENTS.md` documents this
behavior and requires changelog updates for every release.

Reconcile the preserved Phase 3 UI changes before publishing a replacement QDN
app from an exact pushed source state. Instructions and the previous-release
recovery path are in `catalog-maintenance.md`; private collection activation is
not part of that rollout.

## Verification

- TypeScript/Vite production build passes.
- 25 JavaScript metadata/private-policy tests pass.
- 20 Python catalog tests pass.
- 39 real Chromium assertions pass on desktop/mobile, nested Q-App paths,
  full-catalog genre filtering, incremental rendering and mocked upload metadata.
- Whole-app lint retains inherited debt: 58 errors / 207 warnings versus baseline
  60 / 216; exact diagnostic comparison introduces zero new diagnostics.
- Complete identity/timestamp/signature/hash checks and diff whitespace checks pass.
- Live wallet publishing, live audio transfer and private subscriptions were not exercised.

Evidence logs and screenshots:
`/home/crowetic/.local/state/codex/ear-bump-audit/20261121/`.

Earlier progress commits (newest first; final data/report commit follows):

```text
9e1bf54 Require exact decimal strings for subscription tier prices
716f94f Match recording credits and hydrate complete song metadata
9f9ced6 Retain cited genre reviews and add complete refresh workflow
8f293a2 Require genre metadata for new song uploads
24e122d Add conservative secondary genre lookup for unresolved artists
7fcf167 Handle large genre searches and ambiguous artist fallbacks
4979adb Resume genre checkpoints and recover interrupted provider searches
32eefa1 Show app version and maintain release changelog
d94c610 Scaffold private collections and subscriber access policies
21ab563 Add complete catalog pulls and resumable genre enrichment
b6ae0f5 Document legacy song coverage and preserve published dataset
6ca2f3d Phase 2: P1 Spotify-parity features
8d66188 Phase 1: Fix P0 defects and consolidate playback controller
```
