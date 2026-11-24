#!/usr/bin/env node
// Guard for the Cloudflare Workers config (wrangler.jsonc).
// Usage: node scripts/check-wrangler-config.mjs [path-to-config]
// Exits non-zero when the SPA fallback setup is broken.
import { readFileSync } from 'node:fs';

const configPath = process.argv[2] ?? 'wrangler.jsonc';
const EXPECTED_DIRECTORY_SUFFIX = 'grouper-app/dist/grouper-app/browser';

/** Removes // and /* *\/ comments while leaving string contents untouched. */
function stripComments(text) {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') {
        j += text[j] === '\\' ? 2 : 1;
      }
      out += text.slice(i, j + 1);
      i = j + 1;
    } else if (ch === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n') {
        i++;
      }
    } else if (ch === '/' && next === '*') {
      const end = text.indexOf('*/', i + 2);
      i = end === -1 ? text.length : end + 2;
    } else {
      out += ch;
      i++;
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
  const json = stripComments(readFileSync(configPath, 'utf8')).replace(/,(\s*[}\]])/g, '$1');
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
