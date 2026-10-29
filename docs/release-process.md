# Release Process

This repository publishes application versions as GitHub Releases with a production build artifact.

## Preconditions

- CI is green on `main`.
- You have merged all intended changes.
- `grouper-app/package.json` version is updated to the release version.

## Recommended Release Flow (Tag-driven)

1. Update version in `grouper-app/package.json`:
   - `cd grouper-app`
   - `npm version patch` (or `minor` / `major`)
2. Push commit and tag:
   - `git push origin main --follow-tags`
3. GitHub Actions runs `.github/workflows/publish-release.yml` on the tag.
4. The workflow:
   - Installs dependencies
   - Runs lint + unit tests
   - Builds production bundle
   - Packages `dist/grouper-app` into `grouper-app-vX.Y.Z.tar.gz`
   - Creates/updates the GitHub Release and uploads the artifact

## Manual Release Flow (No local tagging)

1. Go to **Actions** -> **Publish Release**.
2. Click **Run workflow** and enter version (example: `1.4.0`).
3. The workflow publishes tag `v1.4.0` from the selected commit and creates the release artifact.

## Version Shown in the App

The footer shows the version the app was built from. `npm start`, `build`, `test` and `lint` first run `npm run write-version`, which writes `src/app/core/version.generated.ts` (not committed) using the first available of:

1. `APP_VERSION` environment variable (set by the release workflow, so releases show exactly `vX.Y.Z`)
2. git, from the latest `v*` tag and the commit (shallow CI clones without tags, like Cloudflare's, fetch them first):
   - `master`/`main`, or the tagged commit itself: `v1.0.0 (abc1234)`
   - other branches: next patch as a release candidate, `v1.0.1-rc.3 (abc1234)` (3 = commits since the tag)
   - no tag: just the commit SHA
3. Cloudflare Workers Builds commit SHA (`WORKERS_CI_COMMIT_SHA`)
4. `unknown` (for example Docker builds, where `.git` is excluded; pass `APP_VERSION` to set it)

## Rollback

- If a release is bad, delete the GitHub Release and tag (`vX.Y.Z`) and publish a new patch version.
- Do not reuse a previously published version number.
