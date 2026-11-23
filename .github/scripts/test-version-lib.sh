#!/usr/bin/env bash
# test-version-lib.sh - self-contained tests for version-lib.sh (issue #112).
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
