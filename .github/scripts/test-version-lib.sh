#!/usr/bin/env bash
# test-version-lib.sh - self-contained tests for version-lib.sh and tag-dependabot-merges.sh (issue #112).
#
# Deterministic by design: no network, no clock, no dependence on the caller's git
# configuration. Run locally with:  bash .github/scripts/test-version-lib.sh
# Requires: bash, git, jq, GNU sort (-V). All exist on ubuntu-latest.
#
# Exit status: 0 when every case passes, 1 when any case fails, 2 when a prerequisite
# is missing. The runner is itself tested (see "runner self-check" at the bottom).

set -uo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
FIXTURE_DIR="$SCRIPT_DIR/fixtures"
SELF="$SCRIPT_DIR/$(basename "${BASH_SOURCE[0]}")"

for tool in jq git sort; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    printf 'ERROR: %s is required to run test-version-lib.sh but was not found in PATH.\n' "$tool" >&2
    exit 2
  fi
done
if ! printf 'v1.9.0\nv1.10.0\n' | sort -V >/dev/null 2>&1; then
  printf 'ERROR: GNU sort with -V support is required to run test-version-lib.sh.\n' >&2
  exit 2
fi

# shellcheck source=version-lib.sh
source "$SCRIPT_DIR/version-lib.sh"

# Fixed identity so tests never depend on (or touch) the user's git config.
export GIT_AUTHOR_NAME='Test Human'
export GIT_AUTHOR_EMAIL='human@example.invalid'
export GIT_COMMITTER_NAME='Test Committer'
export GIT_COMMITTER_EMAIL='committer@example.invalid'
export GIT_CONFIG_GLOBAL=/dev/null
export GIT_CONFIG_SYSTEM=/dev/null
# Fixed dates keep commit ids reproducible (no clock).
export GIT_AUTHOR_DATE='2026-01-01T00:00:00Z'
export GIT_COMMITTER_DATE='2026-01-01T00:00:00Z'

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

PASS=0
FAIL=0
FAILED_NAMES=()

pass() { PASS=$((PASS + 1)); }
fail() {
  FAIL=$((FAIL + 1))
  FAILED_NAMES+=("$1")
  printf 'FAIL: %s\n' "$1" >&2
  shift
  [ $# -gt 0 ] && printf '      %s\n' "$@" >&2
}

# assert_eq <name> <expected> <actual>
assert_eq() {
  if [ "$2" = "$3" ]; then
    pass
  else
    fail "$1" "expected: '$2'" "actual:   '$3'"
  fi
}

# assert_status <name> <expected-status> <actual-status>
assert_status() {
  if [ "$2" -eq "$3" ]; then
    pass
  else
    fail "$1" "expected exit status $2, got $3"
  fi
}

# ---------------------------------------------------------------------------
# Git helpers (throwaway repos under $WORK)
# ---------------------------------------------------------------------------

# new_repo <name>: creates $WORK/<name> on branch master with one root commit; cd's in.
new_repo() {
  local dir="$WORK/$1"
  git init -q -b master "$dir"
  cd "$dir" || exit 2
  git commit -q --allow-empty -m 'chore: root'
}

# commit <message> [author-name]: empty commit; message may contain newlines.
commit() {
  local msg=$1 author=${2:-$GIT_AUTHOR_NAME}
  GIT_AUTHOR_NAME="$author" git commit -q --allow-empty -m "$msg"
}

# tag_head <tag>: lightweight tag on HEAD (the lib only looks at names).
tag_head() { git tag "$1"; }

# caller_records <range>: builds bump_level's stdin the way the real caller must: first-parent
# commits oldest first, FULL message for human authors, SUBJECT ONLY for dependabot[bot]
# (Dependabot bodies embed upstream release notes).
caller_records() {
  local sha author
  while read -r sha; do
    author=$(git log -1 --format=%an "$sha")
    if [ "$author" = "$VERSION_LIB_DEPENDABOT_ACTOR" ]; then
      git log -1 --format=%s "$sha"
    else
      git log -1 --format=%B "$sha"
    fi
    printf '%s\n' "$VERSION_LIB_RECORD_SEP"
  done < <(git rev-list --first-parent --reverse "$1")
}

# level_for_range <range>
level_for_range() { caller_records "$1" | bump_level; }

# base_tag: highest strict semver tag in the current repo.
base_tag() { git tag --list | latest_semver_tag; }

# ---------------------------------------------------------------------------
# Pure lib: latest_semver_tag
# ---------------------------------------------------------------------------
test_latest_semver_tag() {
  assert_eq 'latest_semver_tag ignores 1.0.0 (no v prefix)' 'v0.0.1' \
    "$(printf '1.0.0\nv0.0.1\n' | latest_semver_tag)"
  assert_eq 'latest_semver_tag picks v1.10.0 over v1.9.0 (numeric, not lexical)' 'v1.10.0' \
    "$(printf 'v1.9.0\nv1.10.0\nv1.2.0\n' | latest_semver_tag)"
  assert_eq 'latest_semver_tag picks v2.0.0 over v1.99.99' 'v2.0.0' \
    "$(printf 'v1.99.99\nv2.0.0\n' | latest_semver_tag)"
  assert_eq 'latest_semver_tag ignores pre-release, partial and suffixed tags' 'v1.1.0' \
    "$(printf 'v9.9.9-rc.1\nv9.9\nv9.9.9.9\nv1.1.0\nrelease-v9.9.9\nv9.9.9x\n' | latest_semver_tag)"
  assert_eq 'latest_semver_tag prints nothing when no tag matches' '' \
    "$(printf '1.0.0\nlatest\n' | latest_semver_tag)"
  assert_eq 'latest_semver_tag prints nothing on empty input' '' \
    "$(printf '' | latest_semver_tag)"

  printf '1.0.0\nlatest\n' | latest_semver_tag >/dev/null
  assert_status 'latest_semver_tag returns 0 when no tag matches (set -e safe)' 0 "${PIPESTATUS[1]}"

  new_repo base-selection
  tag_head 1.0.0
  tag_head v1.0.0
  tag_head v1.9.0
  tag_head v1.10.0
  assert_eq 'base selection from a real repo ignores 1.0.0 and sorts numerically' 'v1.10.0' "$(base_tag)"
}

# ---------------------------------------------------------------------------
# Pure lib: next_version
# ---------------------------------------------------------------------------
test_next_version() {
  assert_eq 'next_version patch v1.1.0 -> v1.1.1' 'v1.1.1' "$(next_version v1.1.0 patch)"
  assert_eq 'next_version patch rolls over numerically v1.1.9 -> v1.1.10' 'v1.1.10' "$(next_version v1.1.9 patch)"
  assert_eq 'next_version patch v1.1.99 -> v1.1.100' 'v1.1.100' "$(next_version v1.1.99 patch)"
  assert_eq 'next_version minor v1.1.5 -> v1.2.0 (patch reset)' 'v1.2.0' "$(next_version v1.1.5 minor)"
  assert_eq 'next_version minor v1.9.3 -> v1.10.0' 'v1.10.0' "$(next_version v1.9.3 minor)"
  assert_eq 'next_version minor after minor then patch: v1.2.0 -> v1.2.1' 'v1.2.1' "$(next_version v1.2.0 patch)"
  assert_eq 'next_version treats leading zeros as decimal, not octal' 'v1.9.0' "$(next_version v1.08.5 minor 2>/dev/null)"

  local out status
  out=$(next_version v1.1.0 none 2>/dev/null); status=$?
  assert_status 'next_version rejects level none' 1 "$status"
  assert_eq 'next_version prints nothing on stdout for level none' '' "$out"
  out=$(next_version v1.1.0 major 2>/dev/null); status=$?
  assert_status 'next_version rejects unknown level' 1 "$status"
  out=$(next_version 1.1.0 patch 2>/dev/null); status=$?
  assert_status 'next_version rejects base without v prefix' 1 "$status"
  out=$(next_version '' patch 2>/dev/null); status=$?
  assert_status 'next_version rejects empty base' 1 "$status"
  out=$(next_version v1.1.0-rc.1 patch 2>/dev/null); status=$?
  assert_status 'next_version rejects pre-release base' 1 "$status"
  assert_eq 'next_version prints nothing on stdout for a bad base' '' "$out"
}

# ---------------------------------------------------------------------------
# Pure lib: bump_level on literal records
# ---------------------------------------------------------------------------

# rec <text>: one record terminated by the record separator.
rec() { printf '%s%s' "$1" "$VERSION_LIB_RECORD_SEP"; }

test_bump_level_literal() {
  assert_eq 'bump_level: chore(deps) only -> patch' 'patch' \
    "$(rec 'chore(deps): bump x from 1 to 2 (#1)' | bump_level)"
  assert_eq 'bump_level: fix/docs/ci/build mix -> patch' 'patch' \
    "$( { rec 'fix: a'; rec 'docs: b'; rec 'ci: c'; rec 'build(deps): d'; } | bump_level)"
  assert_eq 'bump_level: Dependabot grouped-PR subject -> patch' 'patch' \
    "$(rec 'chore(deps): bump the angular group across 1 directory with 10 updates (#117)' | bump_level)"
  assert_eq 'bump_level: non-conventional subject -> patch' 'patch' \
    "$(rec 'Merge pull request #5 from x/y' | bump_level)"
  assert_eq 'bump_level: feat: -> minor' 'minor' "$(rec 'feat: add thing (#2)' | bump_level)"
  assert_eq 'bump_level: feat(scope): -> minor' 'minor' "$(rec 'feat(ui): add thing (#2)' | bump_level)"
  assert_eq 'bump_level: any feat among patches -> minor' 'minor' \
    "$( { rec 'fix: a'; rec 'feat: b'; rec 'chore: c'; } | bump_level)"

  assert_eq 'bump_level: feat(scope)!: -> none' 'none' "$(rec 'feat(api)!: drop endpoint' | bump_level)"
  assert_eq 'bump_level: fix!: -> none' 'none' "$(rec 'fix!: change behaviour' | bump_level)"
  assert_eq 'bump_level: chore(deps)!: -> none' 'none' "$(rec 'chore(deps)!: bump major' | bump_level)"
  assert_eq 'bump_level: none beats minor and patch' 'none' \
    "$( { rec 'feat: a'; rec 'fix!: b'; rec 'fix: c'; } | bump_level)"
  assert_eq 'bump_level: BREAKING CHANGE trailer paragraph -> none' 'none' \
    "$(rec $'fix: a thing\n\nSome explanation.\n\nBREAKING CHANGE: removes the old API' | bump_level)"
  assert_eq 'bump_level: BREAKING-CHANGE (hyphen) trailer paragraph -> none' 'none' \
    "$(rec $'fix: a thing\n\nBREAKING-CHANGE: removes the old API' | bump_level)"
  assert_eq 'bump_level: BREAKING CHANGE after other trailers in the final paragraph -> none' 'none' \
    "$(rec $'fix: a thing\n\nReviewed-by: Someone\nBREAKING CHANGE: removes the old API' | bump_level)"

  assert_eq 'bump_level: BREAKING CHANGE in a non-final body paragraph does not block' 'patch' \
    "$(rec $'fix: a thing\n\nBREAKING CHANGE: mentioned mid-body\n\nMore text in the last paragraph.' | bump_level)"
  assert_eq 'bump_level: lowercase "breaking change:" trailer does not block' 'patch' \
    "$(rec $'fix: a thing\n\nbreaking change: not a footer' | bump_level)"
  assert_eq 'bump_level: "feature:" lookalike is not minor' 'patch' "$(rec 'feature: nope' | bump_level)"
  assert_eq 'bump_level: "fix: feat" lookalike is not minor' 'patch' "$(rec 'fix: feat add thing' | bump_level)"
  assert_eq 'bump_level: "feat" without colon is not minor' 'patch' "$(rec 'feat add thing' | bump_level)"
  assert_eq 'bump_level: squash "* feat:" bullets are ignored' 'patch' \
    "$(rec $'fix: squash of several commits (#9)\n\n* feat: inner bullet one\n* feat(ui): inner bullet two\n* fix!: inner bullet three' | bump_level)"
  assert_eq 'bump_level: mid-body "feat:" line is ignored' 'patch' \
    "$(rec $'fix: thing\n\nfeat: this is prose in the body\n\nTrailing paragraph.' | bump_level)"
  assert_eq 'bump_level: a "type!:" line inside the body is ignored' 'patch' \
    "$(rec $'fix: thing\n\nfeat!: prose in the body' | bump_level)"
  assert_eq 'bump_level: "!" before the colon only counts on the subject' 'patch' \
    "$(rec $'fix: thing (see feat!: x)' | bump_level)"

  # A trailer-only body (single paragraph after the subject) is the final paragraph.
  assert_eq 'bump_level: single-paragraph body with BREAKING CHANGE -> none' 'none' \
    "$(rec $'fix: thing\n\nBREAKING CHANGE: x' | bump_level)"
  # A record whose second line directly follows the subject (no blank line) has no body paragraph.
  assert_eq 'bump_level: subject-adjacent BREAKING CHANGE (no blank line) is not a trailer' 'patch' \
    "$(rec $'fix: thing\nBREAKING CHANGE: x' | bump_level)"

  assert_eq 'bump_level: CRLF line endings are tolerated' 'minor' \
    "$(rec $'feat: crlf\r\n\r\nbody\r\n' | bump_level)"
  assert_eq 'bump_level: git-log style leading newline between records' 'minor' \
    "$( { rec 'fix: a'; rec $'\nfeat: b\n'; } | bump_level)"
  assert_eq 'bump_level: last record without terminator is still read' 'minor' \
    "$(printf 'fix: a%sfeat: b' "$VERSION_LIB_RECORD_SEP" | bump_level)"
  assert_eq 'bump_level: empty input -> none (nothing to classify, do not tag)' 'none' \
    "$(printf '' | bump_level)"
  assert_eq 'bump_level: only blank records -> none' 'none' \
    "$( { rec ''; rec $'\n\n'; } | bump_level)"
}

# ---------------------------------------------------------------------------
# Pure lib: bump_level + next_version + base selection against real git history
# ---------------------------------------------------------------------------
test_versioning_in_git() {
  local base level next

  # Three plain merges after v1.1.0 give v1.1.1, v1.1.2, v1.1.3 (base recomputed each time).
  new_repo patch-sequence
  tag_head v1.1.0
  local expected=(v1.1.1 v1.1.2 v1.1.3) i
  for i in 1 2 3; do
    commit "chore(deps): bump dep$i from 1.0.0 to 1.0.1 (#$((100 + i)))" 'dependabot[bot]'
    base=$(base_tag)
    level=$(level_for_range "$base..HEAD")
    next=$(next_version "$base" "$level")
    assert_eq "three plain merges: merge $i level is patch" 'patch' "$level"
    assert_eq "three plain merges: merge $i gets ${expected[i - 1]}" "${expected[i - 1]}" "$next"
    tag_head "$next"
  done

  # feat -> v1.2.0, then the next Dependabot merge is a patch v1.2.1.
  new_repo feat-then-patch
  tag_head v1.1.0
  commit 'feat(sessions): add sample data (#120)'
  base=$(base_tag); level=$(level_for_range "$base..HEAD"); next=$(next_version "$base" "$level")
  assert_eq 'feat since base -> minor' 'minor' "$level"
  assert_eq 'feat since base -> v1.2.0' 'v1.2.0' "$next"
  tag_head "$next"
  commit 'chore(deps): bump y from 2.0.0 to 2.0.1 (#121)' 'dependabot[bot]'
  base=$(base_tag); level=$(level_for_range "$base..HEAD"); next=$(next_version "$base" "$level")
  assert_eq 'after the minor tag the next merge is a patch' 'patch' "$level"
  assert_eq 'after the minor tag the next merge is v1.2.1' 'v1.2.1' "$next"

  # A feat that sits between two Dependabot merges still lifts the later one to minor.
  new_repo feat-between
  tag_head v1.1.0
  commit 'chore(deps): bump a (#130)' 'dependabot[bot]'
  commit 'feat: human feature (#131)'
  commit 'chore(deps): bump b (#132)' 'dependabot[bot]'
  assert_eq 'untagged human feat counts toward the bump of a later merge' 'minor' \
    "$(level_for_range "v1.1.0..HEAD")"
  assert_eq 'range ending before the feat is still patch' 'patch' \
    "$(level_for_range "v1.1.0..HEAD~2")"

  # Breaking change blocks.
  new_repo breaking-block
  tag_head v1.1.0
  commit 'feat(api)!: remove endpoint (#140)'
  commit 'chore(deps): bump c (#141)' 'dependabot[bot]'
  assert_eq 'breaking commit since base -> none' 'none' "$(level_for_range "v1.1.0..HEAD")"

  new_repo breaking-footer
  tag_head v1.1.0
  commit $'fix: tweak (#150)\n\n* fix: inner\n\nBREAKING CHANGE: behaviour changed'
  assert_eq 'BREAKING CHANGE footer in a real commit -> none' 'none' "$(level_for_range "v1.1.0..HEAD")"

  # Dependabot bodies carry upstream release notes; the caller drops them, so they cannot block.
  new_repo dependabot-release-notes
  tag_head v1.1.0
  commit $'chore(deps): bump lib from 1 to 2 (#160)\n\nRelease notes\nfeat: shiny new thing\n\nBREAKING CHANGE: upstream broke their API' 'dependabot[bot]'
  assert_eq 'Dependabot release notes with BREAKING CHANGE and feat: text -> patch' 'patch' \
    "$(level_for_range "v1.1.0..HEAD")"
  # Control: the same body from a human author is honoured (proves the caller helper matters).
  commit $'chore(deps): bump lib from 1 to 2 (#161)\n\nBREAKING CHANGE: human says so'
  assert_eq 'the same trailer from a human author -> none' 'none' "$(level_for_range "v1.1.0..HEAD")"

  # No semver tag at all: base is empty, so the caller must skip.
  new_repo no-semver-tag
  tag_head 1.0.0
  tag_head latest
  assert_eq 'no strict semver tag present -> empty base (caller skips)' '' "$(base_tag)"
  next=$(next_version "$(base_tag)" patch 2>/dev/null); local status=$?
  assert_status 'next_version refuses an empty base so nothing is tagged' 1 "$status"
}

# ---------------------------------------------------------------------------
# resolve_dry_run matrix
# ---------------------------------------------------------------------------
test_resolve_dry_run() {
  local event input var expected actual
  local events=(schedule workflow_dispatch '' push pull_request Schedule)
  local inputs=(true false '' maybe)
  local vars=(true false '' TRUE yes 1)

  for event in "${events[@]}"; do
    for input in "${inputs[@]}"; do
      for var in "${vars[@]}"; do
        case "$event" in
          schedule) [ "$var" = true ] && expected=0 || expected=1 ;;
          workflow_dispatch) [ "$input" = false ] && expected=0 || expected=1 ;;
          *) expected=1 ;;
        esac
        actual=$(resolve_dry_run "$event" "$input" "$var")
        assert_eq "resolve_dry_run event='$event' input='$input' var='$var'" "$expected" "$actual"
      done
    done
  done

  # Spot checks that spell out the contract in prose.
  assert_eq 'schedule with AUTO_TAG_ENABLED=true is real' '0' "$(resolve_dry_run schedule '' true)"
  assert_eq 'schedule with AUTO_TAG_ENABLED unset is dry' '1' "$(resolve_dry_run schedule '' '')"
  assert_eq 'schedule ignores the dispatch input' '1' "$(resolve_dry_run schedule false '')"
  assert_eq 'dispatch dry_run=true is dry even when the variable is true' '1' "$(resolve_dry_run workflow_dispatch true true)"
  assert_eq 'dispatch dry_run=false is real even when the variable is unset' '0' "$(resolve_dry_run workflow_dispatch false '')"
  assert_eq 'dispatch with empty input is dry' '1' "$(resolve_dry_run workflow_dispatch '' true)"
  assert_eq 'unknown event is dry' '1' "$(resolve_dry_run repository_dispatch false true)"
  assert_eq 'missing arguments are dry' '1' "$(resolve_dry_run)"

  resolve_dry_run schedule '' true >/dev/null
  assert_status 'resolve_dry_run returns 0 (set -e safe)' 0 $?
}

# ---------------------------------------------------------------------------
# pr_is_eligible fixtures
# ---------------------------------------------------------------------------
ELIGIBLE_FIXTURE="$FIXTURE_DIR/pr-117-dependabot-auto-merged.json"
HUMAN_FIXTURE="$FIXTURE_DIR/pr-109-human-merged.json"

# eligible_status <file> [sha]: feeds the file on stdin (never argv) and prints the status.
eligible_status() {
  local file=$1 sha=${2-}
  if pr_is_eligible "$sha" <"$file"; then printf '0'; else printf '1'; fi
}

# variant <name> <jq-filter>: derives a PR JSON from the eligible fixture and prints its path.
variant() {
  local out="$WORK/variant-$1.json"
  jq "$2" "$ELIGIBLE_FIXTURE" >"$out"
  printf '%s' "$out"
}

test_pr_is_eligible() {
  local sha f
  [ -s "$ELIGIBLE_FIXTURE" ] || { fail 'eligible fixture exists' "$ELIGIBLE_FIXTURE"; return; }
  [ -s "$HUMAN_FIXTURE" ] || { fail 'human fixture exists' "$HUMAN_FIXTURE"; return; }

  # The fixtures are trimmed copies of real API responses; assert the real values the jq paths rely on.
  assert_eq 'fixture 117 is the real Dependabot PR (user)' 'dependabot[bot]' "$(jq -r '.user.login' "$ELIGIBLE_FIXTURE")"
  assert_eq 'fixture 117 is the real PR number' '117' "$(jq -r '.number' "$ELIGIBLE_FIXTURE")"
  sha=$(jq -r '.merge_commit_sha' "$ELIGIBLE_FIXTURE")
  assert_eq 'fixture 117 merge_commit_sha is the real squash commit' '0ce7d123c5e9b67f84fdbe001980d56283af6f11' "$sha"

  assert_eq 'eligible: real PR #117 (no sha given)' 0 "$(eligible_status "$ELIGIBLE_FIXTURE")"
  assert_eq 'eligible: real PR #117 with matching sha' 0 "$(eligible_status "$ELIGIBLE_FIXTURE" "$sha")"
  assert_eq 'not eligible: real human-merged PR #109' 1 "$(eligible_status "$HUMAN_FIXTURE")"
  assert_eq 'not eligible: real human-merged PR #109 with its own sha' 1 \
    "$(eligible_status "$HUMAN_FIXTURE" "$(jq -r '.merge_commit_sha' "$HUMAN_FIXTURE")")"

  # Oversized JSON (> 128 KiB, the Linux per-argument limit) must still classify correctly via stdin.
  f=$(variant oversized '.body = ("x" * 140000)')
  local size
  size=$(wc -c <"$f")
  if [ "$size" -gt 131072 ]; then pass; else fail 'oversized fixture is larger than 128 KiB' "size=$size"; fi
  assert_eq 'oversized (>128 KiB) eligible PR is still eligible' 0 "$(eligible_status "$f" "$sha")"
  f=$(variant oversized-human '.body = ("x" * 140000) | .user.login = "someone"')
  assert_eq 'oversized (>128 KiB) ineligible PR is still ineligible' 1 "$(eligible_status "$f" "$sha")"

  f=$(variant human-author '.user.login = "kimipsen"')
  assert_eq 'not eligible: human author' 1 "$(eligible_status "$f" "$sha")"
  f=$(variant human-merger '.merged_by.login = "kimipsen"')
  assert_eq 'not eligible: human merged_by' 1 "$(eligible_status "$f" "$sha")"
  f=$(variant manual-dependabot '.merged_by.login = "kimipsen" | .auto_merge = null')
  assert_eq 'not eligible: Dependabot PR merged manually (auto_merge null)' 1 "$(eligible_status "$f" "$sha")"
  f=$(variant bot-merged-no-auto '.auto_merge = null')
  assert_eq 'not eligible: github-actions merged but auto_merge null (signal drift)' 1 "$(eligible_status "$f" "$sha")"
  f=$(variant human-enabled-auto '.auto_merge.enabled_by.login = "kimipsen"')
  assert_eq 'not eligible: auto-merge enabled by a human' 1 "$(eligible_status "$f" "$sha")"
  f=$(variant missing-enabled-by 'del(.auto_merge.enabled_by)')
  assert_eq 'not eligible: auto_merge without enabled_by' 1 "$(eligible_status "$f" "$sha")"
  f=$(variant null-merged-by '.merged_by = null')
  assert_eq 'not eligible: merged_by null' 1 "$(eligible_status "$f" "$sha")"
  assert_eq 'not eligible: merge_commit_sha mismatch' 1 \
    "$(eligible_status "$ELIGIBLE_FIXTURE" '0000000000000000000000000000000000000000')"
  f=$(variant other-base '.base.ref = "release"')
  assert_eq 'not eligible: base.ref is not master' 1 "$(eligible_status "$f" "$sha")"
  f=$(variant unmerged '.merged = false | .merged_by = null | .merge_commit_sha = null | .state = "open"')
  assert_eq 'not eligible: unmerged PR' 1 "$(eligible_status "$f" "$sha")"
  f=$(variant merged-missing 'del(.merged)')
  assert_eq 'not eligible: merged field absent' 1 "$(eligible_status "$f" "$sha")"
  f=$(variant merged-string '.merged = "true"')
  assert_eq 'not eligible: merged is the string "true", not boolean' 1 "$(eligible_status "$f" "$sha")"

  # Title/body containing "404" or bot names must not change the decision.
  f=$(variant title-404 '.title = "fix: handle HTTP 404 (Not Found)" | .body = "gh: Not Found (HTTP 404)"')
  assert_eq 'eligible: title/body containing 404 does not matter' 0 "$(eligible_status "$f" "$sha")"
  f=$(variant body-spoof '.user.login = "kimipsen" | .body = "dependabot[bot] github-actions[bot]"')
  assert_eq 'not eligible: bot names in the body do not spoof the signal' 1 "$(eligible_status "$f" "$sha")"

  # Malformed input fails closed, never eligible.
  printf '' >"$WORK/empty.json"
  assert_eq 'not eligible: empty input' 1 "$(eligible_status "$WORK/empty.json")"
  printf 'not json at all' >"$WORK/garbage.json"
  assert_eq 'not eligible: non-JSON input' 1 "$(eligible_status "$WORK/garbage.json")"
  printf '[]' >"$WORK/array.json"
  assert_eq 'not eligible: JSON array' 1 "$(eligible_status "$WORK/array.json")"
  printf '{"message":"Not Found","status":"404"}' >"$WORK/error-body.json"
  assert_eq 'not eligible: GitHub error body' 1 "$(eligible_status "$WORK/error-body.json")"
}

# ---------------------------------------------------------------------------
# Integration: tag-dependabot-merges.sh against a local bare origin and a fake gh
# ---------------------------------------------------------------------------
TAG_SCRIPT="$SCRIPT_DIR/tag-dependabot-merges.sh"
FAKE_REPO='octo/grouper'

# make_fake_gh <dir>: a PATH-first `gh` that serves $FAKE_GH_DIR/pr-<N>.json and FAILS on any
# endpoint or argument it does not know, so the script cannot pass by calling another API.
# Per-PR failure modes live in $FAKE_GH_DIR/pr-<N>.mode (shapes recorded from gh 2.45.0).
make_fake_gh() {
  mkdir -p "$1"
  cat >"$1/gh" <<'FAKE'
#!/usr/bin/env bash
set -u
dir=${FAKE_GH_DIR:?}
printf '%s\n' "$*" >>"$dir/calls.log"
if [ "$*" = 'repo view --json nameWithOwner -q .nameWithOwner' ]; then
  [ -f "$dir/repo-view-fails" ] && { echo 'gh: not a git repository' >&2; exit 1; }
  printf '%s\n' "${FAKE_GH_REPO:?}"
  exit 0
fi
if [ "$#" -ne 2 ] || [ "$1" != api ] || [[ "$2" != "repos/${FAKE_GH_REPO:?}/pulls/"* ]]; then
  echo "fake gh: unexpected invocation: $*" >&2
  exit 64
fi
n=${2##*/}
[[ "$n" =~ ^[0-9]+$ ]] || { echo "fake gh: bad PR number in: $*" >&2; exit 64; }
mode=ok
[ -f "$dir/pr-$n.mode" ] && mode=$(cat "$dir/pr-$n.mode")
case "$mode" in
  ok)
    [ -f "$dir/pr-$n.json" ] || { echo "fake gh: no fixture for PR $n" >&2; exit 64; }
    cat "$dir/pr-$n.json" ;;
  404) printf '{"message":"Not Found","documentation_url":"https://docs.github.com/rest/pulls/pulls#get-a-pull-request","status":"404"}\n'
       echo 'gh: Not Found (HTTP 404)' >&2; exit 1 ;;
  403) printf '{"message":"API rate limit exceeded","status":"403"}\n'
       echo 'gh: API rate limit exceeded (HTTP 403)' >&2; exit 1 ;;
  429) printf '{"message":"Too Many Requests","status":"429"}\n'
       echo 'gh: Too Many Requests (HTTP 429)' >&2; exit 1 ;;
  500) printf '{"message":"Server Error","status":"500"}\n'
       echo 'gh: Server Error (HTTP 500)' >&2; exit 1 ;;
  empty) exit 0 ;;
  garbage) echo '<html>bad gateway</html>'; exit 0 ;;
  # Not the CLI's 404 line: a lookalike on stdout and a different stderr must NOT count as 404.
  lookalike) printf '{"message":"Not Found (HTTP 404)","status":"404"}\n'
             echo 'gh: connection reset by peer' >&2; exit 1 ;;
  lookalike-stderr) echo 'gh: request failed (HTTP 404) retrying' >&2; exit 1 ;;
  *) echo "fake gh: unknown mode $mode" >&2; exit 64 ;;
esac
FAKE
  chmod +x "$1/gh"
}

# Scenario state: S_REPO (working clone), S_ORIGIN (bare), S_GH (fake gh data dir).
# new_scenario <name>: bare origin + working repo on master with v1.1.0 pushed.
new_scenario() {
  S_NAME=$1
  S_ORIGIN="$WORK/$1-origin.git"
  S_REPO="$WORK/$1"
  S_GH="$WORK/$1-gh"
  S_BIN="$WORK/$1-bin"
  S_SUMMARY="$WORK/$1-summary.md"
  S_TMP="$WORK/$1-tmp"
  mkdir -p "$S_GH" "$S_TMP"
  : >"$S_SUMMARY"
  make_fake_gh "$S_BIN"
  git init -q --bare -b master "$S_ORIGIN"
  new_repo "$1"
  git remote add origin "$S_ORIGIN"
  git tag v1.1.0
  git push -q origin master v1.1.0
}

# pr_json <kind> <number> <sha> <title>: PR response derived from the real #117 / #109 fixtures.
#   dependabot: eligible; drift: Dependabot PR merged by the bot but auto_merge null;
#   human: human author and merger.
pr_json() {
  local kind=$1 number=$2 sha=$3 title=$4 filter
  case "$kind" in
    dependabot) filter='.' ;;
    drift) filter='.auto_merge = null' ;;
    human) filter='.user.login = "kimipsen" | .merged_by.login = "kimipsen" | .auto_merge = null' ;;
    *) echo "pr_json: bad kind $kind" >&2; exit 2 ;;
  esac
  jq --argjson n "$number" --arg sha "$sha" --arg title "$title" \
    ".number = \$n | .merge_commit_sha = \$sha | .title = \$title | $filter" "$ELIGIBLE_FIXTURE"
}

# merge_pr <kind> <number> <title>: adds a squash-style commit "<title> (#<number>)" on master
# (author dependabot[bot] for dependabot/drift) and records the fake PR response.
merge_pr() {
  local kind=$1 number=$2 title=$3 author=$GIT_AUTHOR_NAME
  case "$kind" in dependabot | drift) author=$VERSION_LIB_DEPENDABOT_ACTOR ;; esac
  commit "$title (#$number)" "$author"
  pr_json "$kind" "$number" "$(git rev-parse HEAD)" "$title" >"$S_GH/pr-$number.json"
}

publish_master() { git push -q origin master; }

# run_tag_script [VAR=value ...]: runs the script in the working repo with the fake gh first on
# PATH and WITHOUT any git identity, so the script has to provide its own. Sets RUN_OUT/RUN_STATUS.
run_tag_script() {
  RUN_STATUS=0
  RUN_OUT=$(cd "$S_REPO" && env -u GIT_AUTHOR_NAME -u GIT_AUTHOR_EMAIL -u GIT_COMMITTER_NAME -u GIT_COMMITTER_EMAIL \
    PATH="$S_BIN:$PATH" FAKE_GH_DIR="$S_GH" FAKE_GH_REPO="$FAKE_REPO" GITHUB_REPOSITORY="$FAKE_REPO" \
    GITHUB_STEP_SUMMARY="$S_SUMMARY" TMPDIR="$S_TMP" TARGET_REF=origin/master "$@" \
    bash "$TAG_SCRIPT" 2>&1) || RUN_STATUS=$?
}

local_tags() { git -C "$S_REPO" tag --list 'v*' | sort -V | tr '\n' ' ' | sed 's/ $//'; }
remote_tags() { git -C "$S_ORIGIN" tag --list 'v*' | sort -V | tr '\n' ' ' | sed 's/ $//'; }
all_refs() { git -C "$1" for-each-ref --format='%(refname) %(objectname)'; }
gh_calls() { [ -f "$S_GH/calls.log" ] && cat "$S_GH/calls.log" || true; }
# printed_tags: "<version> #<n>" lines a run printed (real "tagged" or dry "would tag").
printed_tags() { printf '%s\n' "$RUN_OUT" | sed -n 's/^\(tagged\|would tag\) \(v[0-9.]*\) [0-9a-f]* (#\([0-9]*\))$/\2 #\3/p'; }

test_integration_basic() {
  new_scenario basic
  local c1 c2 c3 before after v oid tagger
  merge_pr dependabot 114 'chore(deps): bump a from 1 to 2'
  c1=$(git rev-parse HEAD)
  merge_pr dependabot 113 'chore(deps): bump b from 1 to 2'
  c2=$(git rev-parse HEAD)
  merge_pr dependabot 115 'chore(deps): bump the angular group'
  c3=$(git rev-parse HEAD)
  # A response far over the 128 KiB single-argument limit must not break the run.
  head -c 200000 /dev/zero | tr '\0' x >"$WORK/pad.txt"
  jq --rawfile pad "$WORK/pad.txt" '.body = $pad' "$S_GH/pr-115.json" >"$S_GH/pr-115.big"
  mv "$S_GH/pr-115.big" "$S_GH/pr-115.json"
  publish_master

  run_tag_script
  assert_status 'integration: real run exits 0' 0 "$RUN_STATUS"
  assert_eq 'integration: tags v1.1.1..v1.1.3 created locally' 'v1.1.0 v1.1.1 v1.1.2 v1.1.3' "$(local_tags)"
  assert_eq 'integration: tags pushed to the bare origin' 'v1.1.0 v1.1.1 v1.1.2 v1.1.3' "$(remote_tags)"
  assert_eq 'integration: out-of-order PR numbers are tagged in merge order' $'v1.1.1 #114\nv1.1.2 #113\nv1.1.3 #115' "$(printed_tags)"
  local -a expect_commit=("$c1" "$c2" "$c3") expect_msg=(
    'v1.1.1: chore(deps): bump a from 1 to 2 (#114)'
    'v1.1.2: chore(deps): bump b from 1 to 2 (#113)'
    'v1.1.3: chore(deps): bump the angular group (#115)')
  local i=0
  for v in v1.1.1 v1.1.2 v1.1.3; do
    assert_eq "integration: $v is an annotated tag object" tag "$(git -C "$S_REPO" cat-file -t "refs/tags/$v")"
    assert_eq "integration: $v points at the squash commit" "${expect_commit[$i]}" "$(git -C "$S_REPO" rev-parse "$v^{commit}")"
    assert_eq "integration: $v message" "${expect_msg[$i]}" "$(git -C "$S_REPO" tag -l --format='%(contents:subject)' "$v")"
    assert_eq "integration: $v on origin is the same object" "$(git -C "$S_REPO" rev-parse "refs/tags/$v")" "$(git -C "$S_ORIGIN" rev-parse "refs/tags/$v")"
    i=$((i + 1))
  done
  tagger=$(git -C "$S_REPO" cat-file -p refs/tags/v1.1.1 | sed -n 's/^tagger \(.*\) <.*/\1/p')
  assert_eq 'integration: the script supplies the bot identity itself' 'github-actions[bot]' "$tagger"
  assert_eq 'integration: temp files are removed (TMPDIR is empty)' '' "$(ls -A "$S_TMP")"
  assert_eq 'integration: only expected endpoints were called' $'api repos/octo/grouper/pulls/114\napi repos/octo/grouper/pulls/113\napi repos/octo/grouper/pulls/115' "$(gh_calls)"
  assert_eq 'integration: summary lists the tags' 3 "$(grep -c '^- v1\.1\.[123] on ' "$S_SUMMARY")"

  # Idempotence: nothing new, nothing moves, and no further API calls.
  before=$(all_refs "$S_REPO"; all_refs "$S_ORIGIN")
  : >"$S_GH/calls.log"
  run_tag_script
  after=$(all_refs "$S_REPO"; all_refs "$S_ORIGIN")
  assert_status 'integration: second run exits 0' 0 "$RUN_STATUS"
  assert_eq 'integration: second run creates and moves no refs' "$before" "$after"
  assert_eq 'integration: second run prints no tags' '' "$(printed_tags)"
  assert_eq 'integration: second run makes no API calls' '' "$(gh_calls)"
  oid=$(git -C "$S_REPO" rev-parse refs/tags/v1.1.0)
  assert_eq 'integration: pre-existing tag v1.1.0 is unchanged' "$(git -C "$S_ORIGIN" rev-parse refs/tags/v1.1.0)" "$oid"
}

test_integration_feat() {
  new_scenario feat
  merge_pr dependabot 121 'chore(deps): bump a'
  merge_pr human 122 'feat: add grouping option'   # untagged, but counts toward the bump
  merge_pr dependabot 123 'chore(deps): bump b'
  merge_pr dependabot 124 'chore(deps): bump c'
  publish_master
  run_tag_script
  assert_status 'integration feat: exits 0' 0 "$RUN_STATUS"
  assert_eq 'integration feat: minor after the human feat, then patch' $'v1.1.1 #121\nv1.2.0 #123\nv1.2.1 #124' "$(printed_tags)"
  assert_eq 'integration feat: the human merge is not tagged' 'v1.1.0 v1.1.1 v1.2.0 v1.2.1' "$(local_tags)"
  assert_eq 'integration feat: human merge only looked up, no drift' 0 "$(grep -c 'failing the auto-merge signal' <<<"$RUN_OUT")"
  assert_eq 'integration feat: human merge raises no warning' 0 "$(grep -c '^::warning::' <<<"$RUN_OUT")"
}

test_integration_remote_tag() {
  new_scenario remote
  local oid
  merge_pr dependabot 131 'chore(deps): bump a'
  merge_pr dependabot 132 'chore(deps): bump b'
  publish_master
  # (a) v1.1.1 exists only in the bare origin: created after the clone, local check misses it.
  git -C "$S_ORIGIN" tag v1.1.1 "$(git -C "$S_ORIGIN" rev-parse v1.1.0)"
  oid=$(git -C "$S_ORIGIN" rev-parse refs/tags/v1.1.1)
  run_tag_script
  assert_status 'remote-only tag: run exits 0' 0 "$RUN_STATUS"
  assert_eq 'remote-only tag: no further tags created' '' "$(printed_tags)"
  assert_eq 'remote-only tag: nothing local created' 'v1.1.0' "$(local_tags)"
  assert_eq 'remote-only tag: remote tag object unchanged' "$oid" "$(git -C "$S_ORIGIN" rev-parse refs/tags/v1.1.1)"
  assert_eq 'remote-only tag: stops with the documented message' 1 "$(grep -c 'tag v1.1.1 already exists; next run recomputes' <<<"$RUN_OUT")"

  # (b) pre-receive hook rejects tag pushes and no remote tag appears: the run fails.
  new_scenario reject
  merge_pr dependabot 141 'chore(deps): bump a'
  publish_master
  cat >"$S_ORIGIN/hooks/pre-receive" <<'HOOK'
#!/usr/bin/env bash
while read -r old new ref; do
  case "$ref" in refs/tags/*) echo "rejected by test hook" >&2; exit 1 ;; esac
done
HOOK
  chmod +x "$S_ORIGIN/hooks/pre-receive"
  run_tag_script
  if [ "$RUN_STATUS" -ne 0 ]; then pass; else fail 'push rejection without a remote tag fails the run' "$RUN_OUT"; fi
  assert_eq 'push rejection: no tag on the remote' 'v1.1.0' "$(remote_tags)"
  assert_eq 'push rejection: the unpublished local tag is dropped' 'v1.1.0' "$(local_tags)"

  # (c) race: the hook rejects the push but the tag appears on the remote meanwhile.
  new_scenario race
  merge_pr dependabot 151 'chore(deps): bump a'
  publish_master
  cat >"$S_ORIGIN/hooks/pre-receive" <<'HOOK'
#!/usr/bin/env bash
while read -r old new ref; do
  case "$ref" in refs/tags/v1.1.1)
    # Ref updates are forbidden inside the receive quarantine, so step out of it.
    env -u GIT_QUARANTINE_PATH -u GIT_OBJECT_DIRECTORY -u GIT_ALTERNATE_OBJECT_DIRECTORIES \
      git update-ref refs/tags/v1.1.1 "$(git rev-parse refs/tags/v1.1.0)"
    exit 1 ;; esac
done
HOOK
  chmod +x "$S_ORIGIN/hooks/pre-receive"
  oid=$(git -C "$S_ORIGIN" rev-parse refs/tags/v1.1.0^{commit})
  run_tag_script
  assert_status 'push race with an existing remote tag: exits 0' 0 "$RUN_STATUS"
  assert_eq 'push race: remote tag is not moved' "$oid" "$(git -C "$S_ORIGIN" rev-parse refs/tags/v1.1.1^{commit})"
  assert_eq 'push race: unpublished local tag is dropped' 'v1.1.0' "$(local_tags)"
}

test_integration_lookup_outcomes() {
  local mode
  # 404 is a definitive "not a PR": ineligible, later PRs are still tagged.
  new_scenario notfound
  merge_pr dependabot 161 'chore(deps): bump a'
  commit 'fix: reference an issue not a PR (#162)'
  printf 404 >"$S_GH/pr-162.mode"
  merge_pr dependabot 163 'chore(deps): bump b'
  publish_master
  run_tag_script
  assert_status '404: run exits 0' 0 "$RUN_STATUS"
  assert_eq '404: later PRs are still tagged' $'v1.1.1 #161\nv1.1.2 #163' "$(printed_tags)"
  assert_eq '404: the 404 commit was looked up and skipped' 1 "$(grep -c 'skip .* (#162): not a pull request' <<<"$RUN_OUT")"

  # A 404 lookalike is unknown: stdout text, or a stderr line that is not the CLI's own.
  for mode in lookalike lookalike-stderr; do
    new_scenario "anchor-$mode"
    merge_pr dependabot 171 'chore(deps): bump a'
    commit 'fix: something (#172)'
    printf '%s' "$mode" >"$S_GH/pr-172.mode"
    merge_pr dependabot 173 'chore(deps): bump b'
    publish_master
    run_tag_script
    if [ "$RUN_STATUS" -ne 0 ]; then pass; else fail "404 anchoring: $mode is not treated as 404" "$RUN_OUT"; fi
    assert_eq "404 anchoring ($mode): PR after the failure is not tagged" 'v1.1.0 v1.1.1' "$(local_tags)"
  done

  # A title or body containing 404 on a successful response is judged by pr_is_eligible only.
  new_scenario title404
  merge_pr dependabot 181 'fix(deps): handle HTTP 404 (Not Found) in a'
  merge_pr human 182 'fix: gh: Not Found (HTTP 404)'
  merge_pr dependabot 183 'chore(deps): bump b'
  publish_master
  run_tag_script
  assert_status 'title with 404: exits 0' 0 "$RUN_STATUS"
  assert_eq 'title with 404: eligible tagged, human skipped, later tagged' $'v1.1.1 #181\nv1.1.2 #183' "$(printed_tags)"

  # Fail closed: every unknown outcome aborts before any later PR is tagged.
  for mode in 403 429 500 empty garbage; do
    new_scenario "closed-$mode"
    merge_pr dependabot 191 'chore(deps): bump a'
    merge_pr dependabot 192 'chore(deps): bump b'
    printf '%s' "$mode" >"$S_GH/pr-192.mode"
    merge_pr dependabot 193 'chore(deps): bump c'
    publish_master
    run_tag_script
    if [ "$RUN_STATUS" -ne 0 ]; then pass; else fail "fail-closed: $mode aborts non-zero" "$RUN_OUT"; fi
    assert_eq "fail-closed ($mode): only the PR before the failure is tagged" 'v1.1.0 v1.1.1' "$(local_tags)"
    assert_eq "fail-closed ($mode): no lookup for the PR after the failure" 0 "$(gh_calls | grep -c 'pulls/193$')"
    # A retry after recovery resumes from the same position.
    rm -f "$S_GH/pr-192.mode"
    run_tag_script
    assert_eq "fail-closed ($mode): the next run resumes and tags the rest" 'v1.1.0 v1.1.1 v1.1.2 v1.1.3' "$(local_tags)"
  done
}

test_integration_signal_drift() {
  new_scenario drift
  merge_pr drift 201 'chore(deps): bump a'
  publish_master
  run_tag_script
  assert_status 'drift: run does not fail' 0 "$RUN_STATUS"
  assert_eq 'drift: no tag created' 'v1.1.0' "$(local_tags)"
  assert_eq 'drift: a warning annotation is emitted' 1 "$(grep -c '^::warning::1 Dependabot merge(s) failing the auto-merge signal' <<<"$RUN_OUT")"
  assert_eq 'drift: the summary lists the PR' 1 "$(grep -c '^- #201 ' "$S_SUMMARY")"

  new_scenario nodrift
  merge_pr human 211 'fix: human change'
  publish_master
  run_tag_script
  assert_status 'no drift for human merges: exits 0' 0 "$RUN_STATUS"
  assert_eq 'no drift for human merges: no warning' 0 "$(grep -c '^::warning::' <<<"$RUN_OUT")"
  assert_eq 'no drift for human merges: no summary entry' 0 "$(grep -c 'failing the auto-merge signal' "$S_SUMMARY")"
}

test_integration_blocked() {
  local blocker
  new_scenario blocked
  merge_pr dependabot 221 'chore(deps): bump a'
  merge_pr human 222 'feat!: drop the old export format'
  blocker=$(git rev-parse HEAD)
  merge_pr dependabot 223 'chore(deps): bump b'
  publish_master
  run_tag_script
  assert_status 'blocked: exits 0' 0 "$RUN_STATUS"
  assert_eq 'blocked: only the commit before the blocker is tagged' 'v1.1.0 v1.1.1' "$(local_tags)"
  assert_eq 'blocked: no API call at or after the blocker' 'api repos/octo/grouper/pulls/221' "$(gh_calls)"
  assert_eq 'blocked: warning names the blocking commit' 1 "$(grep -c "^::warning::Automatic tagging blocked since $blocker" <<<"$RUN_OUT")"
  assert_eq 'blocked: summary carries the headline' 1 "$(grep -c "Automatic tagging blocked since $blocker" "$S_SUMMARY")"

  new_scenario blockedfirst
  merge_pr human 231 'fix!: rename everything'
  merge_pr dependabot 232 'chore(deps): bump a'
  publish_master
  run_tag_script
  assert_status 'blocked at the start: exits 0' 0 "$RUN_STATUS"
  assert_eq 'blocked at the start: no tag and no API call' '' "$(local_tags | sed 's/^v1.1.0$//')$(gh_calls)"

  new_scenario nobase
  git tag -d v1.1.0 >/dev/null
  git -C "$S_ORIGIN" tag -d v1.1.0 >/dev/null
  merge_pr dependabot 241 'chore(deps): bump a'
  publish_master
  run_tag_script
  assert_status 'no base tag: exits 0' 0 "$RUN_STATUS"
  assert_eq 'no base tag: warns and tags nothing' 1 "$(grep -c '^::warning::Automatic tagging blocked since .*no semver base tag' <<<"$RUN_OUT")"
  assert_eq 'no base tag: no API call' '' "$(gh_calls)"
}

# build_parity_scenario <name>: same history for the dry/real comparison (feat in the middle).
build_parity_scenario() {
  new_scenario "$1"
  merge_pr dependabot 301 'chore(deps): bump a'
  merge_pr dependabot 302 'chore(deps): bump b'
  merge_pr human 303 'feat: new thing'
  merge_pr dependabot 304 'chore(deps): bump c'
  merge_pr dependabot 305 'chore(deps): bump d'
  publish_master
}

test_integration_dry_run() {
  local before after dry real
  build_parity_scenario dry
  before=$(all_refs "$S_REPO"; all_refs "$S_ORIGIN")
  run_tag_script DRY_RUN=1
  after=$(all_refs "$S_REPO"; all_refs "$S_ORIGIN")
  assert_status 'dry run: exits 0' 0 "$RUN_STATUS"
  assert_eq 'dry run: zero refs created locally or in the bare origin' "$before" "$after"
  dry=$(printed_tags)
  assert_eq 'dry run: simulated sequence advances the base' $'v1.1.1 #301\nv1.1.2 #302\nv1.2.0 #304\nv1.2.1 #305' "$dry"

  build_parity_scenario real
  run_tag_script DRY_RUN=0
  real=$(printed_tags)
  assert_eq 'dry/real parity: the printed sets are equal' "$real" "$dry"
  assert_eq 'dry/real parity: a real run creates exactly that set' 'v1.1.0 v1.1.1 v1.1.2 v1.2.0 v1.2.1' "$(local_tags)"

  # Any other DRY_RUN value fails safe to a dry run.
  build_parity_scenario failsafe
  before=$(all_refs "$S_REPO"; all_refs "$S_ORIGIN")
  run_tag_script DRY_RUN=false
  after=$(all_refs "$S_REPO"; all_refs "$S_ORIGIN")
  assert_eq 'DRY_RUN=false is a dry run (fail safe)' "$before" "$after"
  run_tag_script DRY_RUN=
  after=$(all_refs "$S_REPO"; all_refs "$S_ORIGIN")
  assert_eq 'empty DRY_RUN is a dry run (fail safe)' "$before" "$after"

  # A dry run does not propose a tag that already exists on the remote.
  new_scenario dryremote
  merge_pr dependabot 311 'chore(deps): bump a'
  merge_pr dependabot 312 'chore(deps): bump b'
  publish_master
  git -C "$S_ORIGIN" tag v1.1.2 "$(git -C "$S_ORIGIN" rev-parse v1.1.0)"
  run_tag_script DRY_RUN=1
  assert_eq 'dry run: remote-only tag is not proposed, walk stops' 'v1.1.1 #311' "$(printed_tags)"
  new_scenario realremote
  merge_pr dependabot 311 'chore(deps): bump a'
  merge_pr dependabot 312 'chore(deps): bump b'
  publish_master
  git -C "$S_ORIGIN" tag v1.1.2 "$(git -C "$S_ORIGIN" rev-parse v1.1.0)"
  run_tag_script
  assert_eq 'dry/real parity with a remote-only tag' 'v1.1.1 #311' "$(printed_tags)"

  # Forced dry run (schedule while AUTO_TAG_ENABLED is not true) is announced.
  new_scenario forced
  merge_pr dependabot 321 'chore(deps): bump a'
  publish_master
  run_tag_script DRY_RUN=1 GITHUB_EVENT_NAME=schedule AUTO_TAG_ENABLED=
  assert_status 'forced dry run: exits 0' 0 "$RUN_STATUS"
  assert_eq 'forced dry run: notice annotation' 1 "$(grep -c '^::notice::DRY RUN: AUTO_TAG_ENABLED is not true' <<<"$RUN_OUT")"
  assert_eq 'forced dry run: summary headline' 1 "$(grep -c 'DRY RUN: AUTO_TAG_ENABLED is not true' "$S_SUMMARY")"
  run_tag_script DRY_RUN=1 GITHUB_EVENT_NAME=workflow_dispatch
  assert_eq 'requested dry run (dispatch): no forced-dry-run notice' 0 "$(grep -c '^::notice::' <<<"$RUN_OUT")"
}

test_integration_config() {
  new_scenario config
  merge_pr dependabot 331 'chore(deps): bump a'
  publish_master
  # GITHUB_REPOSITORY defaults from `gh repo view`.
  run_tag_script GITHUB_REPOSITORY= DRY_RUN=1
  assert_status 'config: GITHUB_REPOSITORY falls back to gh repo view' 0 "$RUN_STATUS"
  assert_eq 'config: the fallback asked gh repo view once' 1 "$(gh_calls | grep -c '^repo view --json nameWithOwner -q .nameWithOwner$')"
  # Neither source: fail early with a clear message and no API call.
  : >"$S_GH/calls.log"
  : >"$S_GH/repo-view-fails"
  run_tag_script GITHUB_REPOSITORY= DRY_RUN=1
  if [ "$RUN_STATUS" -ne 0 ]; then pass; else fail 'config: missing GITHUB_REPOSITORY fails early' "$RUN_OUT"; fi
  assert_eq 'config: the error names GITHUB_REPOSITORY' 1 "$(grep -c 'GITHUB_REPOSITORY is not set' <<<"$RUN_OUT")"
  # Unresolvable TARGET_REF.
  run_tag_script TARGET_REF=origin/nonexistent DRY_RUN=1
  if [ "$RUN_STATUS" -ne 0 ]; then pass; else fail 'config: unresolvable TARGET_REF fails' "$RUN_OUT"; fi
}

test_integration() {
  test_integration_basic
  test_integration_feat
  test_integration_remote_tag
  test_integration_lookup_outcomes
  test_integration_signal_drift
  test_integration_blocked
  test_integration_dry_run
  test_integration_config
}

# ---------------------------------------------------------------------------
# Library hygiene
# ---------------------------------------------------------------------------
test_lib_hygiene() {
  local before after out
  # Sourcing twice must work (no readonly redefinition) and must not change shell options.
  before=$(set +o)
  # shellcheck source=version-lib.sh
  source "$SCRIPT_DIR/version-lib.sh"
  after=$(set +o)
  assert_eq 'sourcing the lib does not change shell options' "$before" "$after"

  # The lib must not call git, gh, curl or touch the network.
  if grep -nE '(^|[^_[:alnum:]])(git|gh|curl|wget|nc)[[:space:]]' "$SCRIPT_DIR/version-lib.sh" |
    grep -vE '^[0-9]+:[[:space:]]*#' | grep -vE '^[0-9]+:.*#.*(git|gh)' >/dev/null; then
    fail 'version-lib.sh contains no git/gh/curl invocations' "$(grep -nE '(git|gh|curl|wget)[[:space:]]' "$SCRIPT_DIR/version-lib.sh" | head -3)"
  else
    pass
  fi

  # Tags are never force-pushed or force-replaced (an existing tag must never move).
  if grep -nE 'git (push|tag)[^#]*(--force|--force-with-lease|[[:space:]]-f([[:space:]]|$)|[[:space:]]\+refs)' "$SCRIPT_DIR/tag-dependabot-merges.sh" >/dev/null; then
    fail 'tag-dependabot-merges.sh never forces a push or a tag'
  else
    pass
  fi

  # Strict mode compatibility: the functions work under set -euo pipefail.
  out=$(bash -c "set -euo pipefail; source '$SCRIPT_DIR/version-lib.sh'; printf '1.0.0\n' | latest_semver_tag; resolve_dry_run schedule '' ''; printf 'fix: x\n' | bump_level" 2>&1)
  assert_eq 'functions are safe under set -euo pipefail' $'1\npatch' "$out"
}

# ---------------------------------------------------------------------------
# Runner self-check: a deliberately failing case must make the runner exit non-zero.
# ---------------------------------------------------------------------------
test_runner_self_check() {
  local status out
  out=$(VERSION_LIB_TEST_SELF_CHECK=1 bash "$SELF" 2>&1); status=$?
  if [ "$status" -ne 0 ]; then pass; else fail 'runner exits non-zero when a case fails' "self-check run exited $status"; fi
  if printf '%s' "$out" | grep -q 'deliberate self-check failure'; then pass; else fail 'runner self-check reports the failing case' "$out"; fi
}

main() {
  if [ "${VERSION_LIB_TEST_SELF_CHECK:-}" = 1 ]; then
    # Only the deliberately failing case; used by test_runner_self_check.
    assert_eq 'deliberate self-check failure' 'expected' 'actual'
  else
    test_latest_semver_tag
    test_next_version
    test_bump_level_literal
    test_versioning_in_git
    test_resolve_dry_run
    test_pr_is_eligible
    test_integration
    test_lib_hygiene
    test_runner_self_check
  fi

  printf '\n%d passed, %d failed\n' "$PASS" "$FAIL"
  if [ "$FAIL" -ne 0 ]; then
    printf 'Failed cases:\n' >&2
    printf '  - %s\n' "${FAILED_NAMES[@]}" >&2
    return 1
  fi
  return 0
}

main
exit $?
