---
name: create-documentation
description: Write or update Grouper documentation - README, docs/ guides, user guides, architecture notes, and code-level TSDoc - verified against the actual code and commands. Use when asked to document a feature, update docs after a change, write a user guide, or explain the architecture.
---

# Skill: Create Documentation

## Purpose
Produce documentation that is accurate, concise, and maintained alongside the code. Every claim
must be checked against the source; every command must have been run.

## Use This Skill When
- A feature, product rule, or workflow changed and docs must follow
- Asked for a user guide, how-to, architecture overview, or onboarding notes
- Public services/algorithms lack TSDoc explaining non-obvious behavior

## Where Documentation Lives
| Content | Location |
|---|---|
| Project overview, setup, common commands, product rules | `README.md` |
| Guides and processes (release, user guide, architecture) | `docs/*.md` |
| Images used by docs | `docs/screenshots/` |
| AI agent rules | `AGENTS.md`, `.ai/skills/*/SKILL.md`, `.github/copilot-instructions.md` |
| Code-level explanations | TSDoc on exported services, algorithms, and models |

Product rules (export keeps latest 5 `groupingHistory` entries, `preferenceScoring` defaults
`2`/`-2`, custom weight `mode`, supported locales) appear in both `README.md` and `AGENTS.md`.
When one changes, update **both**.

## Workflow
1. **Identify the audience** before writing: end users (how to use the app, no code),
   contributors (setup, architecture, conventions), or AI agents (rules and guardrails).
   Write for that reader only.
2. **Gather facts from code, not memory.** Read the relevant files:
   - Routes: `grouper-app/src/app/app.routes.ts`
   - Models / persisted shape: `grouper-app/src/app/models/`
   - Logic: `grouper-app/src/app/core/services/`, `grouper-app/src/app/core/algorithms/`
   - UI and wording: `grouper-app/src/app/features/sessions/`, `grouper-app/src/assets/i18n/en.json`
   - Scripts: `grouper-app/package.json`, `Taskfile.dist.yml`, `.github/workflows/`
3. **Use the app's real wording.** For user docs, take button and label names from
   `en.json` (and `da.json` for Danish docs) so the guide matches the screen.
4. **Run every command you document** and confirm it works as written from the stated directory.
5. **Add screenshots where they help** a user find something on screen. Capture them with
   `.ai/skills/generate-screenshots/SKILL.md` into `docs/screenshots/`, reference them with
   relative paths and meaningful alt text (`![Session detail with generated groups](screenshots/session-detail-en-desktop.png)`).
6. **Link, don't duplicate.** Link from `README.md` to new `docs/` pages; avoid copying the same
   explanation into several files.
7. **Verify**: re-read the result against the code, check all relative links resolve
   (`ls` each target), and confirm no placeholder text remains.

## Writing Style
- Markdown, English by default; short sections with task-oriented headings
  ("Export a session", not "Export functionality").
- Lead with what the reader does or needs; put background after.
- Use fenced code blocks with a language tag for commands; state the working directory.
- Use code formatting for identifiers, paths, and config keys.
- No marketing language, no speculative "future work" unless asked.

## TSDoc Guidelines
- Document *why* and non-obvious behavior (scoring rules, limits, defaults, side effects), not
  what the signature already says.
- Match existing density: `storage.service.ts` uses short `/** ... @param ... @returns */` blocks.
- Do not add comments to trivial getters, templates, or tests.

## Guardrails
- Documentation-only changes must not modify application behavior.
- Do not invent features, options, or commands; if unsure, check the code or ask.
- Keep `AGENTS.md` rules and `README.md` product rules consistent with each other.
