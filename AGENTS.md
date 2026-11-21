# Ear-Bump contributor guidance

## Source and delivery

- Writable fork: `https://github.com/crowetic/ear-bump.git`; upstream reference:
  `https://github.com/Qortal/ear-bump`. Inspect branch, tracking and dirty state first.
- Preserve unrelated local work. The canonical checkout may contain older uncommitted
  UI changes; use an isolated worktree when necessary and stage only task files/hunks.
- Commit and push requested progress to the writable fork's `main`; do not push
  generated codegraph caches, HTTP caches, credentials, node_modules or dist.
- Git publication and QDN APP/DOCUMENT publication are separate actions. Follow
  `docs/catalog-maintenance.md` for an authorized QDN release and verification.

## Version tag and release notes

- `package.json` is the source of truth for the app version. Keep its version in
  sync with the root package and package entry in `package-lock.json`.
- The small clickable version tag belongs at the **top left on every screen**,
  including mobile. `src/components/AppVersion.tsx` links to `/changelog` using
  React Router so Q-App `_qdnBase` paths work.
- The canonical changelog is **`CHANGELOG.md` at the repository root**. The
  `/changelog` view (`src/pages/Changelog/Changelog.tsx`) imports it as text; do not
  create a second hand-maintained copy or inject its contents as raw HTML.
- **Update CHANGELOG.md with every release.** Add a dated entry matching the app
  version, keep newest releases first and retain an Unreleased section for future
  work. Describe user-visible behavior and any remaining limitations honestly.
- Bump the version for releases, not for every implementation checkpoint.

## Music data

- Read `docs/song-data-audit.md` and `docs/catalog-maintenance.md` before changing
  catalog scope or metadata precedence. Use graph tools before implementation reads.
- Inventory every QDN identity; distinguish source enumeration from genre coverage.
  Keep original identities, timestamps, signatures, classification confidence and
  lookup outcomes. Native publisher metadata takes precedence over enrichment.
- Never invent a genre, artist or title to satisfy a coverage metric. Uncategorized
  and Unknown artist/title represent review gaps, not completed classifications.
- Keep MusicBrainz requests at least 1.1 seconds apart; retain resumable HTTP caches
  outside Git and review incomplete lookup/metadata reports before publication.

## Private Collections

- Follow `docs/private-collections.md`. The feature remains Coming Soon until its
  encryption, entitlement, payment and playback release gates are complete.
- Never publish plaintext private audio or keys via the public song upload path.
  Do not treat a hidden UI, group ID or unverified browser JSON as authorization.

## Verification

- `npm run build`
- `node --test tests/*.test.mjs`
- `python3 -m unittest discover -s tests -p 'test_*.py'`
- Check lint on changed/new code; existing whole-app lint debt must be reported,
  and task changes must not add diagnostics. Verify desktop/mobile navigation
  and Q-App basename behavior for route/layout changes.
