---
name: generate-screenshots
description: Capture screenshots of the Grouper app (session list and session detail, English and Danish, desktop and mobile) with seeded demo data. Use when asked for screenshots, for visual verification of a UI change, for PR images, or for images in documentation.
---

# Skill: Generate Screenshots

## Purpose
Produce repeatable, deterministic screenshots of the running app using Playwright and the bundled
`capture.mjs` script. Demo data is seeded into `localStorage` so screenshots never depend on
whatever happens to be in the browser.

## Use This Skill When
- A UI change needs visual verification (before/after) or images for a PR description
- Documentation needs up-to-date screenshots (see `.ai/skills/create-documentation/SKILL.md`)
- Checking layout in both locales (`en`, `da`) and at mobile width

## One-time Setup
Playwright is deliberately **not** a repo dependency. Install it outside the repo so no
`package.json` or lockfile changes:

```bash
export PLAYWRIGHT_HOME="${PLAYWRIGHT_HOME:-$HOME/.cache/grouper-playwright}"
mkdir -p "$PLAYWRIGHT_HOME" && cd "$PLAYWRIGHT_HOME"
[ -f package.json ] || npm init -y >/dev/null
npm i -s playwright@1.64.1
npx playwright install --with-deps chromium   # --with-deps needs sudo; drop it if libs exist
```

## Workflow
1. Start the dev server from `grouper-app/` in the background and wait until it answers:
   ```bash
   cd grouper-app && npm start &   # serves http://localhost:4204
   until curl -sf http://localhost:4204 >/dev/null; do sleep 2; done
   ```
2. Capture (run from `grouper-app/`):
   ```bash
   PLAYWRIGHT_HOME="$HOME/.cache/grouper-playwright" \
     node ../.ai/skills/generate-screenshots/capture.mjs --out <output-dir>
   ```
   Options:
   - `--base-url http://localhost:4204` – target another server (e.g. a production build)
   - `--out <dir>` – output directory (default `docs/screenshots`, relative to cwd)
   - `--locales en,da` – locales to capture
   - `--viewports desktop,mobile` – `desktop` is 1440×900, `mobile` is 390×844
   - `--no-seed` – keep the app's own storage instead of the demo sessions
3. Files are named `<page>-<locale>-<viewport>.png`, e.g. `session-detail-da-mobile.png`.
4. **Look at every image** (open/read it) before reporting. Check for: untranslated keys
   (e.g. `sessions.title` shown literally), clipped or overlapping text, horizontal overflow on
   mobile, missing DKFDS styling, and empty states where data was expected.
5. Stop the dev server when done.

## Output Location
- For ad-hoc verification or PR review: write to a temp/scratch directory, not the repo.
- For documentation: write to `docs/screenshots/` and commit only the images the docs reference.
  Re-capture rather than hand-edit images, so they stay reproducible.

## Extending
- New route or state: add an entry to `PAGES` in `capture.mjs`. For interactive states (open
  drawer, generated groups), add a small step after `page.goto` that clicks via accessible
  locators (`page.getByRole('button', { name: ... })`), matching the active locale's text.
- Demo data lives in `buildDemoSessions()`. It uses the stored DTO shape (`SessionDTO` in
  `grouper-app/src/app/models/session.model.ts`, storage key `grouper_sessions`). If the
  persisted model changes, update the demo data in the same change.
- Locale is forced via the `grouper.locale` key used by `I18nService`.

## Guardrails
- Do not add Playwright to `package.json` or change lockfiles for this skill.
- Never use real personal data in demo sessions.
- Keep screenshots deterministic: fixed dates, `reducedMotion`, animations disabled.
