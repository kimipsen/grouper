# GitHub Copilot Skill: Grouper Coding Rules

## Purpose
Give GitHub Copilot repository-scoped coding constraints so generated code aligns with project architecture and standards.

## Priorities
- Keep edits small and task-focused.
- Follow Angular standalone + signals patterns used by the project.
- Maintain strict TypeScript quality (avoid `any`).
- Preserve accessibility and i18n requirements.

## Pull Request Review Focus (UI)
- Review UI changes as a senior product/UI designer and frontend engineer.
- Prioritize issues in: visual hierarchy, typography consistency, spacing rhythm, interaction clarity, and responsive behavior.
- Treat WCAG AA and AXE violations as blocking findings.
- Call out missing UI states (loading, empty, error, disabled, hover/focus/active) and inconsistent component styling.
- Give concrete, implementation-ready feedback instead of generic suggestions.

## Required Checks For Generated Changes
1. Business logic changes include/update nearby tests.
2. Persisted-model changes update model interfaces, storage mapping, import/export validation/defaults, and tests.
3. New UI strings use translation keys and are added to both `en.json` and `da.json`.
4. Accessibility behavior remains WCAG AA and AXE-compliant.

## Repository Rules Snapshot
- App lives in `grouper-app/`; run scripts there.
- Minimum verification command:
  - `cd grouper-app && npm test -- --watch=false`
- Session export includes only latest 5 `groupingHistory` entries.
- Preference scoring defaults:
  - `wantWith: 2`
  - `avoid: -2`

## Avoid
- Unrequested broad refactors.
- Template complexity that violates project conventions.
- Hardcoded user-visible strings.
