#!/usr/bin/env bash
# version-lib.sh - pure helpers for tagging auto-merged Dependabot PRs (issue #112).
#
# This file is meant to be SOURCED. It defines functions and constants only:
#   - no network, no git calls, no file writes, no clock;
#   - it does not change shell options (no `set -e`, no `set -u`), so it is safe to
#     source from scripts that use `set -euo pipefail` and from the test runner.
#
# Functions (all read stdin / arguments and write stdout; status codes are documented):
#   latest_semver_tag                     stdin: tag list. Prints highest strict vX.Y.Z (or nothing).
#   bump_level                            stdin: commit records. Prints none|minor|patch.
#   next_version <base> <level>           Prints the next vX.Y.Z. Status 1 on bad input.
#   pr_is_eligible [<sha>]                stdin: PR JSON (via jq). Status 0 = eligible.
#   resolve_dry_run <event> <input> <var> Prints 1 (dry run) or 0 (real run).

# ---------------------------------------------------------------------------
# Constants. Everything that names an actor, a branch or a delimiter lives here so a
# rename (e.g. of a bot account) is a one-line change.
# ---------------------------------------------------------------------------

# Login of the account that authors Dependabot PRs.
VERSION_LIB_DEPENDABOT_ACTOR='dependabot[bot]'
# Login of the account that enables and performs the auto-merge (the repository's
# dependabot-auto-merge.yml workflow running with GITHUB_TOKEN).
VERSION_LIB_AUTOMERGE_ACTOR='github-actions[bot]'
# Branch the PR must have been merged into.
VERSION_LIB_TARGET_BRANCH='master'
# Strict tag format (the one publish-release.yml validates). ERE, anchored.
VERSION_LIB_SEMVER_TAG_RE='^v[0-9]+\.[0-9]+\.[0-9]+$'
# Record terminator used between commit messages on bump_level's stdin
# (ASCII "record separator"; git log emits it with `--format=%B%x1e`).
VERSION_LIB_RECORD_SEP=$'\x1e'

# ---------------------------------------------------------------------------
# latest_semver_tag
#   Reads a tag list on stdin (one tag per line) and prints the highest tag that matches
#   ^v[0-9]+\.[0-9]+\.[0-9]+$ using version sort (v1.10.0 > v1.9.0). Other formats such
#   as `1.0.0`, `v1.0`, `v1.0.0-rc.1` are ignored. Prints nothing when there is no
#   match. Always returns 0 so callers under `set -e` can test the output instead.
# ---------------------------------------------------------------------------
latest_semver_tag() {
  { grep -E "$VERSION_LIB_SEMVER_TAG_RE" || true; } | sort -V | tail -n 1
}

# ---------------------------------------------------------------------------
# bump_level
#   Reads commit-message records on stdin; each record is terminated by
#   $VERSION_LIB_RECORD_SEP (a final record without terminator is accepted). Prints the
#   strongest level found: none > minor > patch.
#
#   Per record:
#     - subject (first line) only is used for type detection:
#         `type!:` / `type(scope)!:`  -> none   (breaking: leave for a manual release)
#         `feat:` / `feat(scope):`    -> minor
#         anything else               -> patch
#     - a `BREAKING CHANGE:` / `BREAKING-CHANGE:` line counts only inside the FINAL
#       blank-line-separated paragraph of the body (the trailer paragraph) -> none.
#     - every other body line (squash bullets like `* feat: x`, mid-body text) is ignored.
#
#   Empty input prints `none`: with nothing to classify the safe answer is "do not tag".
# ---------------------------------------------------------------------------
bump_level() {
  local level=patch seen=0 record
  while IFS= read -r -d "$VERSION_LIB_RECORD_SEP" record || [ -n "$record" ]; do
    _version_lib_record_is_blank "$record" && continue
    seen=1
    case "$(_version_lib_record_level "$record")" in
      none)
        printf 'none\n'
        return 0
        ;;
      minor) level=minor ;;
    esac
  done
  if [ "$seen" -eq 0 ]; then
    printf 'none\n'
  else
    printf '%s\n' "$level"
  fi
}

# True (status 0) when the record has no non-whitespace character.
_version_lib_record_is_blank() {
  [[ "$1" =~ ^[[:space:]]*$ ]]
}

# Prints the level (none|minor|patch) of one record.
_version_lib_record_level() {
  local record=$1
  local -a lines=()
  local line subject="" i last_blank=-1 start

  # Split into lines, dropping leading blank lines (git log separates records with a
  # newline after the terminator) and trailing blank lines.
  while IFS= read -r line || [ -n "$line" ]; do
    line=${line%$'\r'}
    if [ ${#lines[@]} -eq 0 ] && [[ "$line" =~ ^[[:space:]]*$ ]]; then
      continue
    fi
    lines+=("$line")
  done <<<"$record"
  while [ ${#lines[@]} -gt 0 ] && [[ "${lines[${#lines[@]} - 1]}" =~ ^[[:space:]]*$ ]]; do
    unset 'lines[${#lines[@]}-1]'
  done
  [ ${#lines[@]} -gt 0 ] || { printf 'patch\n'; return 0; }

  subject=${lines[0]}

  if [[ "$subject" =~ ^[a-z]+(\([^\)]*\))?!: ]]; then
    printf 'none\n'
    return 0
  fi

  # Final paragraph of the body: lines after the last blank line, but only if that blank
  # line is not part of the subject block itself (index 0 is the subject).
  for ((i = 1; i < ${#lines[@]}; i++)); do
    if [[ "${lines[i]}" =~ ^[[:space:]]*$ ]]; then
      last_blank=$i
    fi
  done
  if [ "$last_blank" -ge 1 ]; then
    start=$((last_blank + 1))
    for ((i = start; i < ${#lines[@]}; i++)); do
      if [[ "${lines[i]}" =~ ^BREAKING[\ -]CHANGE: ]]; then
        printf 'none\n'
        return 0
      fi
    done
  fi

  if [[ "$subject" =~ ^feat(\([^\)]*\))?: ]]; then
    printf 'minor\n'
  else
    printf 'patch\n'
  fi
}

# ---------------------------------------------------------------------------
# next_version <base> <level>
#   <base> must be a strict vX.Y.Z; <level> must be `minor` or `patch`.
#     minor: vX.(Y+1).0      patch: vX.Y.(Z+1)
#   Arithmetic is decimal and numeric (v1.1.9 -> v1.1.10). Any other input (including
#   level `none`) prints a message on stderr and returns 1 without writing to stdout.
# ---------------------------------------------------------------------------
next_version() {
  local base=${1-} level=${2-} major minor patch rest
  if ! [[ "$base" =~ $VERSION_LIB_SEMVER_TAG_RE ]]; then
    printf 'next_version: invalid base version: %s\n' "$base" >&2
    return 1
  fi
  rest=${base#v}
  major=${rest%%.*}
  rest=${rest#*.}
  minor=${rest%%.*}
  patch=${rest#*.}
  case "$level" in
    minor) printf 'v%d.%d.0\n' "$((10#$major))" "$((10#$minor + 1))" ;;
    patch) printf 'v%d.%d.%d\n' "$((10#$major))" "$((10#$minor))" "$((10#$patch + 1))" ;;
    *)
      printf 'next_version: invalid level: %s\n' "$level" >&2
      return 1
      ;;
  esac
}

# ---------------------------------------------------------------------------
# pr_is_eligible [<sha>]
#   Decides from a GitHub `GET /repos/{r}/pulls/{n}` response whether the PR was merged
#   by the Dependabot auto-merge workflow. The JSON is read from STDIN and is never
#   passed as an argument (Linux limits a single argv string to 128 KiB and real PR
#   bodies reach 64 KiB of release notes). Status 0 = eligible, 1 = not eligible
#   (including malformed JSON). Eligible when all of these hold:
#     merged == true, base.ref == master,
#     user.login == dependabot[bot],
#     merged_by.login == github-actions[bot],
#     auto_merge.enabled_by.login == github-actions[bot],
#     and, when <sha> is given, merge_commit_sha == <sha>.
#   <sha> is a jq --arg value (short string); an empty/absent <sha> skips that check.
# ---------------------------------------------------------------------------
pr_is_eligible() {
  local sha=${1-}
  jq -e \
    --arg sha "$sha" \
    --arg author "$VERSION_LIB_DEPENDABOT_ACTOR" \
    --arg merger "$VERSION_LIB_AUTOMERGE_ACTOR" \
    --arg branch "$VERSION_LIB_TARGET_BRANCH" \
    '
      (.merged == true)
      and (.base.ref == $branch)
      and (.user.login == $author)
      and (.merged_by.login == $merger)
      and (.auto_merge.enabled_by.login == $merger)
      and ($sha == "" or .merge_commit_sha == $sha)
    ' >/dev/null 2>&1
}

# ---------------------------------------------------------------------------
# resolve_dry_run <event_name> <input_dry_run> <var_auto_tag_enabled>
#   Prints `1` (dry run) or `0` (real run). Fails to dry: anything unexpected is dry.
#     schedule:          real only when <var_auto_tag_enabled> is exactly `true`.
#     workflow_dispatch: honours the input: `false` is real, everything else is dry.
#     any other / empty event: dry.
#   Always returns 0 so `DRY_RUN=$(resolve_dry_run ...)` is safe under `set -e`.
# ---------------------------------------------------------------------------
resolve_dry_run() {
  local event=${1-} input=${2-} enabled=${3-}
  case "$event" in
    schedule)
      if [ "$enabled" = "true" ]; then printf '0\n'; else printf '1\n'; fi
      ;;
    workflow_dispatch)
      if [ "$input" = "false" ]; then printf '0\n'; else printf '1\n'; fi
      ;;
    *)
      printf '1\n'
      ;;
  esac
}
