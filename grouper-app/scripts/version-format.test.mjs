import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatVersion } from './version-format.mjs';

const base = { tag: 'v1.0.0', sha: 'abc1234', commitsSinceTag: 3 };

test('shows the tag and SHA on the default branch', () => {
  assert.equal(formatVersion({ ...base, branch: 'master' }), 'v1.0.0 (abc1234)');
  assert.equal(formatVersion({ ...base, branch: 'main' }), 'v1.0.0 (abc1234)');
});

test('shows the next patch as a release candidate on other branches', () => {
  assert.equal(formatVersion({ ...base, branch: 'feat/github-link' }), 'v1.0.1-rc.3 (abc1234)');
  assert.equal(formatVersion({ ...base, tag: 'v2.9.9', branch: 'HEAD' }), 'v2.9.10-rc.3 (abc1234)');
});

test('shows the tag and SHA for the tagged commit on any branch', () => {
  assert.equal(formatVersion({ ...base, commitsSinceTag: 0, branch: 'feat/x' }), 'v1.0.0 (abc1234)');
});

test('keeps a non-plain tag as-is before the rc suffix', () => {
  assert.equal(formatVersion({ ...base, tag: 'v1.0.0-beta.1', branch: 'feat/x' }), 'v1.0.0-beta.1-rc.3 (abc1234)');
});

test('falls back to the SHA without a tag', () => {
  assert.equal(formatVersion({ ...base, tag: '', branch: 'feat/x' }), 'abc1234');
});
