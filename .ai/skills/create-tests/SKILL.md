---
name: create-tests
description: Write or improve Vitest unit tests for Grouper code (algorithms, services, pipes, components, a11y specs) and prove their strength with Stryker mutation testing, iterating until surviving mutants are killed or justified. Use when asked to add tests, raise coverage, test a change, or assess test quality.
---

# Skill: Create Tests (with Mutation Testing)

## Purpose
Write focused tests for the code under change, then **mutation-test the tests you wrote**:
Stryker injects small bugs into the source and reruns the specs. A mutant that survives means a
test would not have caught that bug. Coverage alone is not the goal; killed mutants are.

## Use This Skill When
- Adding or changing behavior (AGENTS.md requires tests for every behavior change)
- Asked to add tests, improve coverage, or evaluate test quality for a file

## Test Stack
- Runner: Vitest via Angular's `@angular/build:unit-test` builder (`ng test`), jsdom,
  globals enabled (`describe`, `it`, `expect`, `vi` - no imports needed).
- Specs sit next to the source: `foo.ts` -> `foo.spec.ts`. Accessibility specs use `*.a11y.spec.ts`.
- Run one spec fast (from `grouper-app/`):
  `npx ng test --watch=false --include src/app/core/algorithms/random-grouping.algorithm.spec.ts`
- Full suite: `npm test -- --watch=false`

## Workflow

### 1. Understand the code
Read the source and any existing spec. List the behaviors: normal paths, edge cases (empty
lists, one person, group size larger than people, partial groups), defaults (e.g.
`preferenceScoring` `2`/`-2`), error paths, and product rules (export keeps latest 5
`groupingHistory` entries).

### 2. Write tests following repo conventions
- **Algorithms / pure logic** (`core/algorithms/`): plain `describe/it`, no TestBed. Make
  randomness deterministic with `vi.spyOn(Math, 'random')` when outcomes depend on it, or assert
  invariants (everyone placed exactly once, group sizes within bounds).
- **Services** (`core/services/`): `TestBed.inject`, clear `localStorage` in `beforeEach`;
  test persisted round-trips through the DTO mapping, defaults on import, and validation failures.
- **Components** (`features/`): `TestBed.configureTestingModule({ imports: [Component] })`, set
  inputs with `fixture.componentRef.setInput(...)`, query the DOM by role/text/aria, and assert
  outputs by subscribing to the `output()`. Mock `I18nService` the way existing specs do (see
  `app.a11y.spec.ts`) and return keys or fixed labels.
- **Accessibility** (`*.a11y.spec.ts`): named buttons, labelled form controls, landmarks/headings.
- Assert specific values, not just truthiness; one behavior per `it`; descriptive names
  (`it('keeps only the latest 5 grouping history entries on export')`).
- Never weaken production code or add test-only branches to make tests pass.

### 3. Run the specs until green
`npx ng test --watch=false --include <spec>` and fix failures (in tests, or report real bugs found).

### 4. Mutation-test the new tests
One-time setup, outside the repo (no `package.json`/lockfile changes):
```bash
export STRYKER_HOME="${STRYKER_HOME:-$HOME/.cache/grouper-stryker}"
mkdir -p "$STRYKER_HOME" && cd "$STRYKER_HOME"
[ -f package.json ] || npm init -y >/dev/null
npm i -s @stryker-mutator/core@10.1.1 @stryker-mutator/typescript-checker@10.1.1 typescript@5.9
```

Run from `grouper-app/`, passing the **source** files the new tests target (sibling specs are
picked up automatically; add others with `--spec`):
```bash
STRYKER_HOME="$HOME/.cache/grouper-stryker" node ../.ai/skills/create-tests/run-mutation.mjs \
  src/app/core/algorithms/random-grouping.algorithm.ts
```
How it works: Stryker's `command` runner executes `ng test --include <specs>` per mutant (Angular
owns the Vitest config, so the Vitest runner plugin cannot be used). The TypeScript checker marks
type-invalid mutants as `CompileError` instead of counting them as killed. Expect roughly
3-4 s per mutant; keep the `mutate` scope to the files you are testing. Reports
(`mutation.json`, `mutation.html`) go to `$STRYKER_HOME/reports` (override with `--report-dir`),
never into the repo.

### 5. Kill survivors
List surviving mutants from the JSON report:
```bash
node -e 'const r=require(process.argv[1]);for(const[f,d]of Object.entries(r.files))for(const m of d.mutants)if(["Survived","NoCoverage"].includes(m.status))console.log(`${f}:${m.location.start.line} ${m.mutatorName} -> ${m.replacement}`)' \
  "$STRYKER_HOME/reports/mutation.json"
```
For each survivor:
- **Add or sharpen a test** that fails with the mutant (e.g. boundary value for an `EqualityOperator`
  mutant, exact assertion for a `StringLiteral`, verifying a call for a removed `CallExpression`).
- Or **justify it** as equivalent/irrelevant (logging text, a mutant with identical behavior).
  Do not add assertions on console messages just to kill mutants.

Re-run step 4. Target: **>= 80 % mutation score** on the touched files, and every remaining
survivor explained.

### 6. Final verification
- `npm test -- --watch=false` (full suite) passes.
- `npm run lint` passes for changed spec files.
- `git status` shows no `.stryker-tmp/` or `reports/` in the repo.

## Reporting
Summarize: tests added (file + behaviors covered), mutation score before -> after per file,
and each remaining survivor with its justification. Mention real bugs found separately; do not
silently "fix" production code inside a testing task without saying so.

## Guardrails
- Do not add Stryker to `package.json` or modify lockfiles unless the user asks for it.
- Do not lower the bar by deleting assertions or skipping tests (`it.skip`, `xit`).
- Keep tests deterministic: no real timers, network, or dependence on current date/locale.
