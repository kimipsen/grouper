#!/usr/bin/env node
// Guard for the Cloudflare Workers config (wrangler.jsonc).
// Usage: node scripts/check-wrangler-config.mjs
// Checks the repo's wrangler.jsonc and exits non-zero when the SPA fallback setup is broken.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const configPath = 'wrangler.jsonc';
const configFile = fileURLToPath(new URL(`../${configPath}`, import.meta.url));
const EXPECTED_DIRECTORY_SUFFIX = 'grouper-app/dist/grouper-app/browser';

/** Index just past the closing quote of the string literal that starts at `start`. */
function stringEnd(text, start) {
  let j = start + 1;
  while (j < text.length && text[j] !== '"') {
    j += text[j] === '\\' ? 2 : 1;
  }
  return j + 1;
}

/** Index just past the comment that starts at `start` (a line comment keeps its newline), or `start` when there is none. */
function commentEnd(text, start) {
  if (text.startsWith('//', start)) {
    const newline = text.indexOf('\n', start);
    return newline === -1 ? text.length : newline;
  }
  if (text.startsWith('/*', start)) {
    const end = text.indexOf('*/', start + 2);
    return end === -1 ? text.length : end + 2;
  }
  return start;
}

/** Removes // and /* *\/ comments while leaving string contents untouched. */
function stripComments(text) {
  let out = '';
  let i = 0;
  while (i < text.length) {
    if (text[i] === '"') {
      const end = stringEnd(text, i);
      out += text.slice(i, end);
      i = end;
    } else {
      const end = commentEnd(text, i);
      if (end === i) {
        out += text[i];
        i++;
      } else {
        i = end;
      }
    }
  }
  return out;
}

function fail(message) {
  console.error(`check-wrangler-config: ${message}`);
  process.exit(1);
}

let config;
try {
  // Trailing commas are allowed in JSONC, so drop them before parsing.
  const json = stripComments(readFileSync(configFile, 'utf8')).replace(/,(\s*[}\]])/g, '$1');
  config = JSON.parse(json);
} catch (error) {
  fail(`cannot read or parse ${configPath}: ${error.message}`);
}

const errors = [];
if (config.name !== 'grouper') {
  errors.push(`name must be "grouper" (got ${JSON.stringify(config.name)})`);
}
const assets = config.assets ?? {};
if (assets.not_found_handling !== 'single-page-application') {
  errors.push(
    `assets.not_found_handling must be "single-page-application" (got ${JSON.stringify(assets.not_found_handling)})`,
  );
}
if ('run_worker_first' in assets || 'run_worker_first' in config) {
  errors.push('run_worker_first must be absent');
}
if (typeof assets.directory !== 'string' || !assets.directory.endsWith(EXPECTED_DIRECTORY_SUFFIX)) {
  errors.push(
    `assets.directory must end with "${EXPECTED_DIRECTORY_SUFFIX}" (got ${JSON.stringify(assets.directory)})`,
  );
}

if (errors.length > 0) {
  fail(`${configPath} is invalid:\n- ${errors.join('\n- ')}`);
}
console.log(`check-wrangler-config: ${configPath} OK`);
