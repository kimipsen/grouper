# Release Process

Application versions live **only in git tags** (`vMAJOR.MINOR.PATCH`). `grouper-app/package.json` stays at `0.0.0` and is never bumped, and nothing commits a version to `master`.

There are two separate things, and they are deliberately decoupled:

- **Tagging** creates a version tag. Non-major Dependabot updates are tagged automatically; everything else is tagged by hand.
- **Releasing** publishes a GitHub Release with a production build artifact. This is always a manual action.

## Automatic Tags for Dependabot Merges

The workflow `.github/workflows/tag-dependabot-merges.yml` (**Tag Dependabot Merges**) runs every 30 minutes on `master` (and on demand through **Run workflow**). It creates one annotated tag per eligible merge, oldest first, so three merges produce three tags (for example `v1.1.1`, `v1.1.2`, `v1.1.3`).

A merge on `master` is eligible when GitHub reports that its pull request:

- was authored by `dependabot[bot]`, and
- was merged by `github-actions[bot]` with auto-merge enabled by `github-actions[bot]` (the Dependabot auto-merge workflow, which only enables auto-merge for non-major updates).

Human pull requests, manually merged Dependabot pull requests (for example major updates) and unmerged pull requests never get a tag.

### Version level

The base is the highest tag matching `^v[0-9]+\.[0-9]+\.[0-9]+$`; other tags (such as `1.0.0`) are ignored. The conventional-commit types of all commits after the base, up to and including the merge, decide the bump:

| Commits since the base tag | Result |
|---|---|
| A breaking change (`type!:` or a `BREAKING CHANGE:` footer) | No tag; release manually (see below) |
| At least one `feat` | Minor bump, patch reset to 0 (`v1.1.0` -> `v1.2.0`); the next merge is a patch (`v1.2.1`) |
| Anything else | Patch bump (`v1.1.0` -> `v1.1.1`) |

Bump analysis reads the first-parent history of `master`, so it relies on the repository's **squash-merge** convention: each pull request is one commit whose subject carries the conventional-commit type and ends in `(#N)`. A non-squash `Merge pull request #N` commit would be classified as a patch even if the branch contained a `feat` or a breaking change.

### What the tag is

- An annotated tag on the squash-merge commit, with the message `vX.Y.Z: <PR title> (#N)`.
- Only a tag: no GitHub Release, no artifact, no commit. The tag is pushed with the workflow `GITHUB_TOKEN`, which by design does not trigger `publish-release.yml`.
- Existing tags are never moved or overwritten. A run that finds its tag already present stops without failing.
- Latency is up to 30 minutes after the merge (the cron interval). To tag sooner, use **Run workflow** with **Dry run** unchecked.

### Dry-run gate (`AUTO_TAG_ENABLED`)

Scheduled runs are **dry runs** until the repository variable `AUTO_TAG_ENABLED` is exactly `true` (**Settings** -> **Secrets and variables** -> **Actions** -> **Variables**). A dry run logs and summarises the tags it would create, without creating or pushing anything. It simulates base advancement, so it previews exactly what a real run would create.

Manual runs use the **Dry run** input, which defaults to on. Any ambiguous value resolves to a dry run.

Before enabling, review a dry run: it should propose tags for the merges since `v1.1.0` that are eligible and none for human or major merges. Then set `AUTO_TAG_ENABLED` to `true`. After the first real auto-merged Dependabot pull request, confirm its tag appears within one cron interval, that no **Publish Release** run started and that no GitHub Release was created.

### Reading the run summary

Problems are reported in the workflow run, not by failing the job (a failing cron job would send an email every 30 minutes). Open the run and read the **summary** and the annotations:

- **Automatic tagging blocked since `<sha>`**: a breaking change (or no reachable base tag) is stopping automatic tagging. Release manually (see below); once a tag exists at or after the blocking commit, automatic tagging continues from there.
- **DRY RUN: AUTO_TAG_ENABLED is not true**: the scheduled run was forced to be a dry run by the gate above.
- **Dependabot merges failing the auto-merge signal**: Dependabot pull requests were merged without the `github-actions[bot]` auto-merge signal. A few are expected (major updates merged by hand). A persistent warning for merges that *should* have been auto-merged means GitHub changed how auto-merge is reported and the eligibility signal in `.github/scripts/version-lib.sh` needs re-verification.

The job does fail on a pull request lookup error other than "not found" (rate limit, server error, unparsable response) and on a push rejected for any reason other than an existing tag. Tags are created oldest first and a skipped merge can never be tagged later, so the run aborts and the next run retries from the same place. If a lookup stays stuck permanently, create the tag by hand on or after the blocking commit (see below); the reconciler no longer examines commits at or before the latest tag.

## Manual Tags and Releases

Use this path for breaking changes, major updates and any release you want to publish. Releasing stays manual: automatic tags never publish anything.

### Tag-driven release

1. Make sure CI is green on `master` and all intended changes are merged.
2. Create and push an annotated tag on the commit to release:
   - `git fetch --tags origin`
   - `git tag -a vX.Y.Z -m "vX.Y.Z" <commit>`
   - `git push origin vX.Y.Z`
3. GitHub Actions runs `.github/workflows/publish-release.yml` on the tag. The workflow:
   - Installs dependencies
   - Runs lint + unit tests
   - Builds the production bundle
   - Packages `dist/grouper-app` into `grouper-app-vX.Y.Z.tar.gz`
   - Creates/updates the GitHub Release and uploads the artifact

Do not run `npm version` and do not edit `grouper-app/package.json`: the version is the tag.

### Manual workflow release (no local tagging)

1. Go to **Actions** -> **Publish Release**.
2. Click **Run workflow** and enter the version (example: `1.4.0`).
3. The workflow publishes tag `v1.4.0` from the selected commit and creates the release artifact.

### Choosing the version

- Use a version higher than the latest `vX.Y.Z` tag. After a breaking change that blocked automatic tagging, a manual tag at or after the blocking commit unblocks it.
- If the next version you want already exists as an automatic tag, pick a higher version, or release the existing tag instead of creating a second one.
- To release an existing automatic tag, run **Publish Release** (**Run workflow**), choose that tag as the branch/tag to run from, and enter the same version. The release attaches to the existing tag, which is never moved.

## Version Shown in the App

The footer shows the version the app was built from. `npm start`, `build`, `test` and `lint` first run `npm run write-version`, which writes `src/app/core/version.generated.ts` (not committed) using the first available of:

1. `APP_VERSION` environment variable (set by the release workflow, so releases show exactly `vX.Y.Z`)
2. git, from the latest `v*` tag and the commit (shallow CI clones without tags, like Cloudflare's, fetch them first):
   - `master`, or the tagged commit itself: `v1.0.0 (abc1234)`
   - other branches: next patch as a release candidate, `v1.0.1-rc.3 (abc1234)` (3 = commits since the tag)
   - no tag: just the commit SHA
3. Cloudflare Workers Builds commit SHA (`WORKERS_CI_COMMIT_SHA`)
4. `unknown` (for example Docker builds, where `.git` is excluded; pass `APP_VERSION` to set it)

Because automatic tags are real `v*` tags, the footer of a build from `master` advances with each tagged Dependabot merge (for example `v1.1.5 (abc1234)`), and release-candidate versions on other branches are computed from the newest tag. This is intended, even though no GitHub Release exists for those tags.

## Rollback

- **Bad release:** delete the GitHub Release and its tag (`git push origin :refs/tags/vX.Y.Z`), then publish a new patch version. Do not reuse a version number that was published as a GitHub Release.
- **Wrongly created automatic tag:** set `AUTO_TAG_ENABLED` to anything other than `true` (or disable the **Tag Dependabot Merges** workflow), then delete the tag with `git push origin :refs/tags/<tag>`. A tag that never had a GitHub Release was never published, so its version number may be reused; this rule takes precedence over the one above. Delete any local copy with `git tag -d <tag>`.

## One-off Cleanup: Stray `1.0.0` Tag

The repository has a stray tag `1.0.0` (no `v` prefix) next to the real `v1.0.0`. The tooling ignores it, so it is harmless, but it should be removed once by a maintainer with permission to delete tags; the workflow token is intentionally not given that right. Keep `v1.0.0`:

```bash
git push origin :refs/tags/1.0.0
```
