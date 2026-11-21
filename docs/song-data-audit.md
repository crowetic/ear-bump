# Old song data audit — 2026-11-21 (before fixes)

Source checkout: `/home/crowetic/git-repos/ear-bump`.
Writable fork: `https://github.com/crowetic/ear-bump.git` (`origin/main`).
Upstream reference: `/home/crowetic/git-repos/Q-Apps-code/ear-bump`,
`https://github.com/Qortal/ear-bump`; do not push there.
No repository or ancestor AGENTS.md existed at audit time.

## What actually exists

The list is a JSON object with `schema`, `revision`, `dataset`, `summary`,
`classificationPolicy`, and a `songs` array. Each song has its original
(service, publisher, identifier), artist, title, genre, original publish time,
evidence and classification provenance. It is not a playlist of audio files.

Original workstation artifacts:
`/home/crowetic/.local/state/codex/ear-bump-publication/20261120/`:
`legacy-qdn-metadata-complete.json`, `legacy-genres-reviewed.json`,
`classification-review.csv`, `classify.py`, and retrieval-failure/validation reports.
Exact snapshots are now retained in `data/legacy/source-2026-11-20.json` and
`data/legacy/genres-2026-11-20.json` for reproducible comparisons.

| Metric | Count |
| --- | ---: |
| Source AUDIO resources, excluding node-blocked names | 3,407 |
| Unique QDN identities | 3,407 |
| Source resources with usable metadata | 3,395 |
| List rows | 3,407 |
| Nonempty genre strings | 3,407 |
| Empty/missing genre strings | 0 |
| Actual classifications (74.70%) | 2,545 |
| Uncategorized (25.30%) | 862 |
| Publisher-provided genres | 2 |
| Editorial inferences | 2,543 |
| Unknown title placeholders | 35 |
| Unknown artist placeholders | 38 |
| Distinct artist/title pairs | 3,276 |

The original unfiltered survey returned 3,422 resources; 15 were excluded by the
node's block policy. This exclusion must always be disclosed when saying "all".

| Artist | Title | Genre | Evidence |
| --- | --- | --- | --- |
| Disturbed | Avarice | Metal | inferred artist context |
| Louis Armstrong | Blueberry Hill | Jazz | inferred artist context |
| Gimma | & Tschüss | Hip-Hop | inferred artist context |
| Unknown artist | Unknown title | Uncategorized | missing metadata |

## Why coverage is sparse

Enumeration completed for the snapshot. The old `classify.py` asserts exactly
3,407 records, reads a workstation-only snapshot, and uses a hardcoded artist
map plus a few title/format rules. It has no source pagination, external search
client, rate limiting, retry/checkpoint loop, or per-song external search record.
Only 639 entries cite artist-context URLs; 1,474 use an unsourced artist map.
The script does not establish that every recording was searched externally.
There is no evidence that API throttling caused the old classification gap:
there was no external lookup loop to throttle. Unknown or ambiguous artists
were intentionally left Uncategorized. The 12 unavailable source descriptions
and 35/38 missing identities require publisher correction or manual review.

The app loader in the uncommitted source has a second reproducibility gap:
`VITE_LEGACY_GENRE_PUBLISHER` defaults to empty. A normal build silently disables
legacy genres. Yesterday's published build explicitly supplied `crodex`.
It also caches the list for 24 hours and once per app session. An older app or
unconfigured rebuild can therefore show much poorer coverage than the published
list. Existing source search includes a complete metadata scan, but Home's
newest feed is intentionally limited and does not represent all catalog songs.

No repository data-pull script, scheduler, or installed user crontab was found.
The only classification script was outside Git. The existing app's session scan
is discovery for the UI; it is not an auditable enrichment/publishing job.

## Publication and Git state at audit

Git HEAD `6ca2f3d3d744869aa6feccb9d908b0b5da822285`, branch `main`, tracking
`origin/main` at `b13edd5976cb79fc3c706238fde555cc938f8811`.
Two local completed commits: `8d66188` (Phase 1), `6ca2f3d` (Phase 2).
46 modified tracked source/config files and 13 untracked source/docs/test paths,
plus the untracked generated `codegraph-cache/`. None staged. Those inherited
edits are preserved in the canonical checkout; delivery work uses an isolated
worktree. No generated graph or credentials are included in commits.

Publication receipts at
`/home/crowetic/.local/state/codex/ear-bump-publication/20261120-retry/`
confirm these QDN transactions on 2026-11-20:

| Locator | Confirmed block |
| --- | ---: |
| DOCUMENT/crodex/earbump_legacy_genres_v1_r20261120_01 | 2803777 |
| DOCUMENT/crodex/earbump_legacy_genres_v1 | 2803778 |
| APP/crodex/default | 2803779 |

Both documents matched SHA-256
`02989e3a3e9a40e81721a809002b62e41a38e164e87fbabd8b0c0c9877891175`
and 2,892,850 bytes. The app ZIP was 530,743 bytes. The source and data were
not committed/pushed. A fresh MCP node status check during this audit returned
DOWNLOADING, demonstrating that current availability also depends on the serving
node; this does not invalidate the confirmed transaction receipt. The public
Core currently enumerates 3,407 matching songs, independently matching the snapshot.

Publishing source to Git does not update APP/crodex. A new QDN publication is a
separate release action; retain the original resource revisions and receipts.
