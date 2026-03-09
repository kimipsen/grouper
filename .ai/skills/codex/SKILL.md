# Codex Skill: Grouper Repository Workflow

## Purpose
Provide Codex-specific execution guidance for making safe, localized changes in this repository.

## Use This Skill When
- Implementing or updating Angular application behavior in `grouper-app/`
- Changing domain models, storage DTOs, import/export logic, or grouping algorithms
- Updating UI text, accessibility behavior, or tests

## Workflow
1. Keep changes localized to the requested scope.
2. Preserve existing patterns (standalone components, signals, service boundaries).
3. If persisted data models change, update model types, mappings/defaults, validation, and tests.
4. If user-facing text changes, update both translation files:
   - `grouper-app/src/assets/i18n/en.json`
   - `grouper-app/src/assets/i18n/da.json`
5. Run relevant tests from `grouper-app/`, minimum:
   - `npm test -- --watch=false`

## Guardrails
- Do not revert unrelated repository changes.
- Do not perform destructive git operations.
- Do not change lockfiles unless required by the task.
- Prefer small, explicit methods over broad refactors.

## Key Paths
- Models: `grouper-app/src/app/models/`
- Services: `grouper-app/src/app/core/services/`
- Algorithms: `grouper-app/src/app/core/algorithms/`
- Sessions feature: `grouper-app/src/app/features/sessions/`
