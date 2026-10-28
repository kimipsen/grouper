// Runs Stryker mutation testing for selected source files, using only their sibling specs.
//
// Usage (run from grouper-app/, see SKILL.md for installing Stryker outside the repo):
//   STRYKER_HOME=/path/to/stryker node ../.ai/skills/create-tests/run-mutation.mjs \
//     src/app/core/algorithms/random-grouping.algorithm.ts [more source files...] \
//     [--spec extra.spec.ts] [--concurrency 2] [--report-dir /path/to/reports]
//
// Exits non-zero if Stryker fails to run. The mutation score itself is printed, not enforced.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const strykerHome = process.env.STRYKER_HOME;
if (!strykerHome || !existsSync(path.join(strykerHome, 'node_modules/.bin/stryker'))) {
  console.error('Set STRYKER_HOME to a dir with @stryker-mutator/core installed (see SKILL.md).');
  process.exit(2);
}
if (!existsSync('angular.json')) {
  console.error('Run this script from grouper-app/.');
  process.exit(2);
}

const sources = [];
const specs = [];
let concurrency = 2;
let reportDir = path.join(strykerHome, 'reports');

const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];
  if (arg === '--spec') specs.push(argv[++i]);
  else if (arg === '--concurrency') concurrency = Number(argv[++i]);
  else if (arg === '--report-dir') reportDir = path.resolve(argv[++i]);
  else sources.push(arg);
}

if (sources.length === 0) {
  console.error('Pass at least one source file to mutate.');
  process.exit(2);
}

for (const source of sources) {
  const spec = source.replace(/\.ts$/, '.spec.ts');
  if (existsSync(spec)) specs.push(spec);
}
if (specs.length === 0) {
  console.error('No spec files found next to the sources; pass them with --spec.');
  process.exit(2);
}

const includeFlags = [...new Set(specs)].map((spec) => `--include ${spec}`).join(' ');
mkdirSync(reportDir, { recursive: true });

const config = {
  testRunner: 'command',
  commandRunner: { command: `npx ng test --watch=false ${includeFlags}` },
  mutate: sources,
  checkers: ['typescript'],
  tsconfigFile: 'tsconfig.app.json',
  typescriptChecker: { prioritizePerformanceOverAccuracy: true },
  plugins: ['@stryker-mutator/typescript-checker'],
  coverageAnalysis: 'off',
  concurrency,
  timeoutMS: 60000,
  reporters: ['clear-text', 'progress', 'json', 'html'],
  jsonReporter: { fileName: path.join(reportDir, 'mutation.json') },
  htmlReporter: { fileName: path.join(reportDir, 'mutation.html') },
  tempDirName: '.stryker-tmp',
  cleanTempDir: 'always',
};

const configPath = path.join(reportDir, 'stryker.config.json');
writeFileSync(configPath, JSON.stringify(config, null, 2));
console.log(`Mutating ${sources.join(', ')}\nUsing specs ${[...new Set(specs)].join(', ')}\n`);

const result = spawnSync(path.join(strykerHome, 'node_modules/.bin/stryker'), ['run', configPath], {
  stdio: 'inherit',
});
console.log(`\nReports: ${path.join(reportDir, 'mutation.json')} and mutation.html`);
process.exit(result.status ?? 1);
