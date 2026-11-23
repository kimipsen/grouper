#!/usr/bin/env bash
# tag-dependabot-merges.sh - scheduled reconciler that tags auto-merged Dependabot PRs (issue #112).
#
# Walks the first-parent history of TARGET_REF after the latest strict vX.Y.Z tag, oldest
# first, and creates one annotated tag per merge that GitHub's PR API identifies as a
# Dependabot PR merged by the repository's auto-merge workflow. It is stateless and
# idempotent: a second run over the same history creates nothing.
#
# Environment (all optional unless noted):
#   TARGET_REF         Ref whose first-parent history is walked.            default: origin/master
#   REMOTE             Remote that tags are pushed to / checked against.    default: origin
#   DRY_RUN            unset = real run (local/test use only), 0 = real run,
#                      1 = dry run, any other value = dry run (fail safe).
#                      A dry run creates and pushes nothing but simulates base advancement.
#   GITHUB_REPOSITORY  owner/name. Set by Actions. When unset, taken from
#                      `gh repo view --json nameWithOwner -q .nameWithOwner`; the script
#                      fails early when neither yields a value.
#   GITHUB_EVENT_NAME, AUTO_TAG_ENABLED
#                      Only used to explain a dry run forced by the rollout gate
#                      (event "schedule" while AUTO_TAG_ENABLED is not "true").
#   GITHUB_STEP_SUMMARY  Markdown summary file; written once at exit (/dev/null when unset).
#   GH_TOKEN           Used by `gh` (provided by the workflow).
#   GIT_AUTHOR_NAME, GIT_AUTHOR_EMAIL, GIT_COMMITTER_NAME, GIT_COMMITTER_EMAIL
#                      Default to the github-actions[bot] identity, which a fresh runner lacks.
#
# The checkout must contain the full history and all tags (fetch-depth: 0).
#
# Exit status: 0 on success, a clean stop (tag already exists) or a blocked state;
# non-zero on any lookup error that is not a 404, on a push failure other than "tag already
# exists", and on a configuration error.

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
# shellcheck source=version-lib.sh
source "$SCRIPT_DIR/version-lib.sh"

TARGET_REF=${TARGET_REF:-origin/master}
REMOTE=${REMOTE:-origin}

# DRY_RUN contract: unset = real, 0 = real, everything else (1, false, yes, empty...) = dry.
if [ -z "${DRY_RUN+x}" ] || [ "$DRY_RUN" = 0 ]; then
  DRY=0
else
  DRY=1
fi

# Git identity: a fresh ubuntu-latest runner has none and `git tag -a` would fail.
export GIT_AUTHOR_NAME=${GIT_AUTHOR_NAME:-github-actions[bot]}
export GIT_COMMITTER_NAME=${GIT_COMMITTER_NAME:-github-actions[bot]}
export GIT_AUTHOR_EMAIL=${GIT_AUTHOR_EMAIL:-41898282+github-actions[bot]@users.noreply.github.com}
export GIT_COMMITTER_EMAIL=${GIT_COMMITTER_EMAIL:-41898282+github-actions[bot]@users.noreply.github.com}

# ---------------------------------------------------------------------------
# State
# ---------------------------------------------------------------------------
PR_TMP=$(mktemp)
ERR_TMP=$(mktemp)
SUMMARY_FILE=${GITHUB_STEP_SUMMARY:-/dev/null}

declare -A SIM_TAGS=()   # dry run only: would-be version -> commit sha
HEADLINES=()             # summary headlines (blocked / forced dry run / drift)
TAGGED_LINES=()          # summary rows: tagged or would-be-tagged
SKIPPED_LINES=()         # summary rows: skipped commits with reason
DRIFT_LINES=()           # summary rows: Dependabot merges failing the auto-merge signal

# Runs on every exit (also on aborts): writes the summary in one go, headlines first,
# because $GITHUB_STEP_SUMMARY can only be appended to, then removes the temp files.
finish() {
  local status=$?
  trap - EXIT
  {
    printf '## Tag Dependabot merges%s\n\n' "$([ "$DRY" -eq 1 ] && printf ' (dry run)')"
    if [ ${#HEADLINES[@]} -gt 0 ]; then
      printf '%s\n\n' "${HEADLINES[@]}"
    fi
    if [ ${#TAGGED_LINES[@]} -gt 0 ]; then
      printf '### %s\n\n' "$([ "$DRY" -eq 1 ] && printf 'Would tag' || printf 'Tagged')"
      printf -- '- %s\n' "${TAGGED_LINES[@]}"
      printf '\n'
    fi
    if [ ${#SKIPPED_LINES[@]} -gt 0 ]; then
      printf '### Skipped\n\n'
      printf -- '- %s\n' "${SKIPPED_LINES[@]}"
      printf '\n'
    fi
    if [ ${#DRIFT_LINES[@]} -gt 0 ]; then
      printf '### Dependabot merges failing the auto-merge signal\n\n'
      printf -- '- %s\n' "${DRIFT_LINES[@]}"
      printf '\n'
    fi
    if [ "$status" -ne 0 ]; then
      printf 'The run failed with exit status %d; see the job log.\n' "$status"
    fi
  } >>"$SUMMARY_FILE" 2>/dev/null || true
  rm -f "$PR_TMP" "$ERR_TMP"
  exit "$status"
}
trap finish EXIT

log() { printf '%s\n' "$*"; }
warn() { printf '::warning::%s\n' "$*"; }
notice() { printf '::notice::%s\n' "$*"; }
die() {
  printf '::error::%s\n' "$*" >&2
  exit 1
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# Prints the highest strict semver tag (real tags plus, in a dry run, would-be tags).
highest_tag() {
  {
    git tag --list
    if [ ${#SIM_TAGS[@]} -gt 0 ]; then
      printf '%s\n' "${!SIM_TAGS[@]}"
    fi
  } | latest_semver_tag
}

# Prints the commit sha of a tag name; would-be tags resolve through SIM_TAGS because git
# cannot resolve a tag that was never created.
tag_commit() {
  if [ -n "${SIM_TAGS[$1]+x}" ]; then
    printf '%s\n' "${SIM_TAGS[$1]}"
  else
    git rev-parse --verify --quiet "refs/tags/$1^{commit}" || true
  fi
}

# Sets BASE_TAG and BASE_SHA from the current tags (empty when there is none).
recompute_base() {
  BASE_TAG=$(highest_tag)
  BASE_SHA=
  if [ -n "$BASE_TAG" ]; then
    BASE_SHA=$(tag_commit "$BASE_TAG")
  fi
}

# Prints the bump_level record of one commit: the full message for humans, the subject only
# for dependabot[bot] (its bodies embed upstream release notes).
commit_record() {
  local sha=$1
  if [ "$(git log -1 --format=%an "$sha")" = "$VERSION_LIB_DEPENDABOT_ACTOR" ]; then
    git log -1 --format=%s "$sha"
  else
    git log -1 --format=%B "$sha"
  fi
}

# range_level <base-sha> <commit-sha>: bump level of the first-parent commits in base..commit.
range_level() {
  local sha
  while read -r sha; do
    commit_record "$sha"
    printf '%s\n' "$VERSION_LIB_RECORD_SEP"
  done < <(git rev-list --first-parent --reverse "$1..$2") | bump_level
}

# first_blocker <base-sha> <commit-sha>: first commit of the range that alone forces `none`.
first_blocker() {
  local sha
  while read -r sha; do
    if [ "$({ commit_record "$sha"; printf '%s\n' "$VERSION_LIB_RECORD_SEP"; } | bump_level)" = none ]; then
      printf '%s\n' "$sha"
      return 0
    fi
  done < <(git rev-list --first-parent --reverse "$1..$2")
  printf '%s\n' "$2"
}

block() {
  local sha=$1 reason=$2 msg
  msg="Automatic tagging blocked since ${sha}: ${reason}"
  warn "$msg"
  HEADLINES+=("**${msg}**")
  log "$msg"
}

# fetch_pr <number>: writes the PR JSON to $PR_TMP (never through argv) and prints one of
# `ok`, `not-found` or `unknown`. A 404 is only recognised from the CLI's own error line on
# stderr (`gh: ... (HTTP 404)`), never from stdout, titles or bodies.
fetch_pr() {
  local rc=0
  : >"$PR_TMP"
  : >"$ERR_TMP"
  gh api "repos/$GITHUB_REPOSITORY/pulls/$1" >"$PR_TMP" 2>"$ERR_TMP" || rc=$?
  if [ "$rc" -ne 0 ]; then
    if grep -Eq '^gh: .*\(HTTP 404\)$' "$ERR_TMP"; then
      printf 'not-found\n'
    else
      printf 'unknown\n'
    fi
    return 0
  fi
  if jq -e 'type == "object"' <"$PR_TMP" >/dev/null 2>&1; then
    printf 'ok\n'
  else
    printf 'unknown\n'
  fi
}

# True when the PR in $PR_TMP is a merged Dependabot PR that fails the auto-merge signal.
pr_is_signal_drift() {
  jq -e \
    --arg author "$VERSION_LIB_DEPENDABOT_ACTOR" \
    --arg merger "$VERSION_LIB_AUTOMERGE_ACTOR" \
    '
      (.merged == true) and (.user.login == $author)
      and ((.merged_by.login // "") != $merger or (.auto_merge.enabled_by.login // "") != $merger)
    ' <"$PR_TMP" >/dev/null 2>&1
}

# remote_has_tag <version>: status 0 = exists, 1 = absent; any ls-remote error aborts the run.
remote_has_tag() {
  local rc=0
  git ls-remote --exit-code --tags "$REMOTE" "refs/tags/$1" >/dev/null 2>&1 || rc=$?
  case "$rc" in
    0) return 0 ;;
    2) return 1 ;;
    *) die "git ls-remote against '$REMOTE' failed with status $rc while checking tag $1" ;;
  esac
}

# ---------------------------------------------------------------------------
# Walk
# ---------------------------------------------------------------------------

# Processes first-parent commits oldest first. Returns normally on every clean stop.
walk() {
  local c subject number level status version title msg rc
  local -a commits

  recompute_base
  if [ -z "$BASE_SHA" ]; then
    block "$TARGET_SHA" "no semver base tag (vX.Y.Z) exists"
    return 0
  fi
  if ! git merge-base --is-ancestor "$BASE_SHA" "$TARGET_SHA"; then
    block "$TARGET_SHA" "base tag $BASE_TAG is not an ancestor of $TARGET_REF"
    return 0
  fi

  mapfile -t commits < <(git rev-list --first-parent --reverse "$BASE_SHA..$TARGET_SHA")
  log "Base ${BASE_TAG} (${BASE_SHA}); ${#commits[@]} first-parent commit(s) to examine up to ${TARGET_SHA}."

  for c in "${commits[@]}"; do
    subject=$(git log -1 --format=%s "$c")
    if ! [[ "$subject" =~ \(#([0-9]+)\)$ ]]; then
      log "skip ${c:0:7}: no PR number in subject"
      SKIPPED_LINES+=("\`${c:0:7}\` ${subject}: no PR number in the subject")
      continue
    fi
    number=${BASH_REMATCH[1]}

    recompute_base
    if ! git merge-base --is-ancestor "$BASE_SHA" "$c"; then
      log "skip ${c:0:7} (#${number}): base ${BASE_TAG} is not an ancestor"
      SKIPPED_LINES+=("\`${c:0:7}\` #${number}: base ${BASE_TAG} is not an ancestor")
      continue
    fi

    # Cheap-first: decide the bump locally; a blocked range stays blocked for every later
    # commit, so the walk stops before any API call.
    level=$(range_level "$BASE_SHA" "$c")
    if [ "$level" = none ]; then
      block "$(first_blocker "$BASE_SHA" "$c")" "breaking change after ${BASE_TAG}; release manually"
      return 0
    fi

    status=$(fetch_pr "$number")
    case "$status" in
      ok) ;;
      not-found)
        log "skip ${c:0:7} (#${number}): not a pull request in ${GITHUB_REPOSITORY} (HTTP 404)"
        SKIPPED_LINES+=("\`${c:0:7}\` #${number}: not a pull request (HTTP 404)")
        continue
        ;;
      *)
        die "lookup of PR #${number} (${c}) failed with an unknown error; aborting before any later PR is tagged: $(head -n 1 "$ERR_TMP")"
        ;;
    esac

    if pr_is_signal_drift; then
      DRIFT_LINES+=("#${number} (\`${c:0:7}\`): Dependabot PR merged without the auto-merge signal")
    fi

    if ! pr_is_eligible "$c" <"$PR_TMP"; then
      log "skip ${c:0:7} (#${number}): not a Dependabot PR merged by auto-merge"
      SKIPPED_LINES+=("\`${c:0:7}\` #${number}: not merged by Dependabot auto-merge")
      continue
    fi

    version=$(next_version "$BASE_TAG" "$level")
    title=$(jq -r '(.title // "") | gsub("[\\r\\n]+"; " ")' <"$PR_TMP")
    [ -n "$title" ] || title="PR #${number}"
    msg="${version}: ${title} (#${number})"

    if [ -n "$(git rev-parse -q --verify "refs/tags/$version" || true)" ] || remote_has_tag "$version"; then
      log "tag ${version} already exists; next run recomputes"
      SKIPPED_LINES+=("${version} already exists; stopped, the next run recomputes")
      return 0
    fi

    if [ "$DRY" -eq 1 ]; then
      SIM_TAGS[$version]=$c
      log "would tag ${version} ${c} (#${number})"
      TAGGED_LINES+=("${version} on \`${c:0:7}\` (#${number}) ${title}")
      continue
    fi

    git tag -a "$version" "$c" -m "$msg"
    rc=0
    git push "$REMOTE" "refs/tags/$version" || rc=$?
    if [ "$rc" -ne 0 ]; then
      # Drop the tag this run created so a local base never points at an unpublished tag.
      git tag -d "$version" >/dev/null
      if remote_has_tag "$version"; then
        log "tag ${version} already exists; next run recomputes"
        SKIPPED_LINES+=("${version} already exists on ${REMOTE}; stopped, the next run recomputes")
        return 0
      fi
      die "pushing tag ${version} to ${REMOTE} was rejected (status ${rc}) and the tag does not exist there"
    fi
    log "tagged ${version} ${c} (#${number})"
    TAGGED_LINES+=("${version} on \`${c:0:7}\` (#${number}) ${title}")
  done
}

main() {
  if [ -z "${GITHUB_REPOSITORY:-}" ]; then
    GITHUB_REPOSITORY=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || true)
  fi
  [ -n "${GITHUB_REPOSITORY:-}" ] ||
    die "GITHUB_REPOSITORY is not set and 'gh repo view' could not determine it (expected owner/name)"
  export GITHUB_REPOSITORY

  TARGET_SHA=$(git rev-parse --verify --quiet "${TARGET_REF}^{commit}") ||
    die "TARGET_REF '${TARGET_REF}' does not resolve to a commit"

  if [ "$DRY" -eq 1 ]; then
    log "DRY RUN: no tags will be created or pushed."
    if [ "${GITHUB_EVENT_NAME:-}" = schedule ] && [ "${AUTO_TAG_ENABLED:-}" != true ]; then
      notice "DRY RUN: AUTO_TAG_ENABLED is not true"
      HEADLINES+=("**DRY RUN: AUTO_TAG_ENABLED is not true**")
    fi
  fi

  walk

  if [ ${#DRIFT_LINES[@]} -gt 0 ]; then
    warn "${#DRIFT_LINES[@]} Dependabot merge(s) failing the auto-merge signal; re-verify the eligibility signal if this persists"
    HEADLINES+=("**${#DRIFT_LINES[@]} Dependabot merge(s) failing the auto-merge signal (see below)**")
  fi
  log "Done: ${#TAGGED_LINES[@]} tag(s) $([ "$DRY" -eq 1 ] && printf 'proposed' || printf 'created')."
}

main "$@"
