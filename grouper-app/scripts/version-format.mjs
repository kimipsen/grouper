// Pure formatting for the app version shown in the footer; see write-version.mjs.

const DEFAULT_BRANCHES = new Set(['master', 'main']);
const PLAIN_TAG = /^v(\d+)\.(\d+)\.(\d+)$/;

/**
 * - No tag: just the SHA.
 * - Default branch, or the tagged commit itself: "v1.0.0 (abc1234)".
 * - Any other branch: next patch as a release candidate, "v1.0.1-rc.3 (abc1234)",
 *   where 3 is the number of commits since the tag.
 */
export function formatVersion({ tag, sha, commitsSinceTag, branch }) {
  if (!tag) {
    return sha;
  }
  if (DEFAULT_BRANCHES.has(branch) || !commitsSinceTag) {
    return `${tag} (${sha})`;
  }
  const match = PLAIN_TAG.exec(tag);
  const next = match ? `v${match[1]}.${match[2]}.${Number(match[3]) + 1}` : tag;
  return `${next}-rc.${commitsSinceTag} (${sha})`;
}
