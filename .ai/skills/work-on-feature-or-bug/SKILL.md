---
name: work-on-feature-or-bug
description: End-to-end workflow for implementing a feature or fixing a bug in Grouper - always in a dedicated git worktree on its own branch, then verified, committed, pushed, and opened as a GitHub pull request. Use whenever asked to build, change, or fix something in the app.
---

# Skill: Work on a Feature or Bug

## Purpose
Isolate every feature/bug task in its own git worktree so it never touches the main checkout,
which other agents and the user may be using at the same time. Finish by pushing the branch and
opening a pull request against `master`.

## Use This Skill When
- Implementing a feature or enhancement
- Fixing a bug (reported issue, failing test, wrong behavior)
- Any code change that should end up as a PR

## Rules
- **All edits, builds, tests, and git commands run inside the worktree.** Never switch branches,
  stage, or commit in the main checkout (`/workspaces/grouper` or wherever the repo root is).
- One task = one branch = one worktree = one PR.
- Follow `AGENTS.md` for code, i18n, accessibility, DKFDS, and testing rules.
- Never bypass hooks or signing (`--no-verify`, `-c commit.gpgsign=false`). If a hook or signing
  fails, fix the cause or stop and report it.

## Workflow

### 1. Understand the task
- Read the request/issue. If it references a GitHub issue: `gh issue view <number>`.
- For a **bug**, find the cause before changing code: locate the code path and, where possible,
  reproduce it with a failing test (or in the running app).
- Ask the user only if the expected behavior is genuinely ambiguous.

### 2. Create the worktree
Pick a branch name following conventional-commit types (commitlint is enforced):
`feat/<short-slug>` for features, `fix/<short-slug>` for bugs. From the repo root:
```bash
SLUG=<short-slug>                  # e.g. export-history-limit
BRANCH=fix/$SLUG                   # or feat/$SLUG
WT=.worktrees/$SLUG

git fetch origin master
git show-ref --quiet "refs/heads/$BRANCH" || git ls-remote --exit-code --heads origin "$BRANCH" \
  && echo "Branch exists - pick another slug"   # must not reuse an existing branch
grep -qx '/.worktrees/' .gitignore .git/info/exclude 2>/dev/null || echo '/.worktrees/' >> .git/info/exclude
git worktree add --no-track -b "$BRANCH" "$WT" origin/master
cd "$WT"
```

### 3. Install dependencies in the worktree
`node_modules` and the husky hook shims are not shared between worktrees:
```bash
npm install                        # root: husky + commitlint (root lockfile is untracked)
npm --prefix grouper-app ci        # app: exact versions from grouper-app/package-lock.json
```
Do not commit lockfile changes caused by this step.

### 4. Implement
- **Bug**: write a test that fails because of the bug, then fix the code until it passes.
- **Feature**: implement in small steps following existing patterns (signals, standalone
  components, `inject()`, `input()`/`output()`, OnPush, DKFDS classes).
- Persisted model changes: update interfaces, DTO mapping, import/export validation/defaults, tests.
- New UI text: translation keys in both `en.json` and `da.json`.
- Use the companion skills:
  - Tests + mutation testing: `.ai/skills/create-tests/SKILL.md`
  - Docs when behavior, rules, or commands change: `.ai/skills/create-documentation/SKILL.md`
  - UI changes: `.ai/skills/generate-screenshots/SKILL.md`. The main checkout may already use
    port 4204, so serve the worktree on another port and pass it to the script:
    `cd grouper-app && npx ng serve --port 4205` and `capture.mjs --base-url http://localhost:4205`.

### 5. Verify (from `$WT/grouper-app`)
```bash
npm test -- --watch=false
npm run lint
npm run build
npm run test:a11y                  # when UI changed
```
All must pass. Re-read the full diff (`git diff origin/master`) for leftovers: debug output,
unrelated edits, hardcoded strings, `any`.

### 6. Commit
Stage explicit paths only and use a conventional commit message (`feat(scope): ...`,
`fix(scope): ...`), with the agent's required attribution trailer:
```bash
git add <changed paths>
git status --short                 # confirm only task files are staged
git commit -m "fix(export): keep only latest 5 grouping history entries"
```
The pre-commit hook runs lint and the full test suite; commit-msg runs commitlint.

### 7. Push and open the pull request
```bash
git push -u origin "$BRANCH"
gh pr create --base master --head "$BRANCH" --title "<same as commit subject>" --body-file <file>
```
PR body template:
```markdown
## Summary
<what changed and why; for bugs: root cause and fix>

## Changes
- <file/area>: <change>

## Verification
- `npm test -- --watch=false`, `npm run lint`, `npm run build` pass
- <mutation score for touched files, manual checks, screenshots>

Closes #<issue>                    <!-- only if an issue exists -->
```
Append the agent's required PR attribution line. Report the PR URL to the user.

### 8. Follow-ups and cleanup
- Review feedback: work in the same worktree, commit, and `git push` (no force-push unless asked).
- Keep the worktree until the PR is merged or closed, then from the repo root:
  ```bash
  git worktree remove .worktrees/$SLUG
  git branch -d "$BRANCH"            # only after merge; use the remote's state to confirm
  ```
- List active worktrees with `git worktree list`; prune stale entries with `git worktree prune`.

## Guardrails
- Do not modify, stage, or revert files in the main checkout or other worktrees.
- Do not push to `master` or open a PR from `master`.
- Do not change lockfiles unless the task requires a dependency change.
- If `gh auth status` fails or the push is rejected, stop and report; do not work around it.
