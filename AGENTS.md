# AI Instructions For This Repository

## Project Scope
- Main application code is in `grouper-app/` (Angular 21, standalone components).
- Root `package.json` is minimal; use `grouper-app/package.json` scripts for day-to-day work.

## Quick Start
- Install deps in app folder: `cd grouper-app && npm install`
- Run app: `npm start`
- Run tests: `npm test -- --watch=false`

## Architecture Notes
- Core domain models: `grouper-app/src/app/models/`
- Business logic/services: `grouper-app/src/app/core/services/`
- Grouping algorithms: `grouper-app/src/app/core/algorithms/`
- Feature UI: `grouper-app/src/app/features/sessions/`
- Translations: `grouper-app/src/assets/i18n/`

## Current Product Rules (Important)
- Session export only includes the latest 5 `groupingHistory` entries.
  - Implemented in `session-storage.service.ts`.
- Preference-based grouping supports configurable numeric scoring per session:
  - `preferenceScoring.wantWith`
  - `preferenceScoring.avoid`
  - Defaults are `2` and `-2`.
- Supported locales are English (`en`) and Danish (`da`).
  - If adding user-visible strings, update both locale files.

## Coding Guidelines
- Keep changes localized; avoid broad refactors unless requested.
- Preserve existing patterns (Angular signals/services, existing folder layout).
- Prefer small, explicit methods over hidden side effects.
- For persisted model changes, update:
  - Runtime model interfaces
  - DTO/storage mapping
  - Import/export validation and defaults
  - Relevant tests

## Testing Expectations
- Add or update tests for every behavior change.
- At minimum, run `npm test -- --watch=false` in `grouper-app/`.
- Favor unit tests near changed logic:
  - Algorithms: `core/algorithms/*.spec.ts`
  - Services/storage: `core/services/*.spec.ts`
  - UI behavior: feature/component specs where applicable

## i18n Expectations
- New UI text must be translation keys, not hardcoded strings.
- Keep key structure consistent across `en.json` and `da.json`.
- Preserve interpolation placeholders exactly (e.g., `{{count}}`).

## Do Not
- Do not revert unrelated workspace changes.
- Do not introduce destructive git operations.
- Do not change generated lockfiles unless required by the requested task.

## TypeScript Best Practices
- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when type is uncertain
## Angular Best Practices
- Always use standalone components over NgModules
- Must NOT set `standalone: true` inside Angular decorators. It's the default in Angular v20+.
- Use signals for state management
- Implement lazy loading for feature routes
- Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host bindings inside the `host` object of the `@Component` or `@Directive` decorator instead
- Use `NgOptimizedImage` for all static images.
  - `NgOptimizedImage` does not work for inline base64 images.
## Accessibility Requirements
- It MUST pass all AXE checks.
- It MUST follow all WCAG AA minimums, including focus management, color contrast, and ARIA attributes.
### Components
- Keep components small and focused on a single responsibility
- Use `input()` and `output()` functions instead of decorators
- Use `computed()` for derived state
- Set `changeDetection: ChangeDetectionStrategy.OnPush` in `@Component` decorator
- Prefer inline templates for small components
- Prefer Reactive forms instead of Template-driven ones
- Do NOT use `ngClass`, use `class` bindings instead
- Do NOT use `ngStyle`, use `style` bindings instead
- When using external templates/styles, use paths relative to the component TS file.
## State Management
- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable
- Do NOT use `mutate` on signals, use `update` or `set` instead
## Templates
- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`
- Use the async pipe to handle observables
- Do not assume globals like (`new Date()`) are available.
- Do not write arrow functions in templates (they are not supported).
## Services
- Design services around a single responsibility
- Use the `providedIn: 'root'` option for singleton services
- Use the `inject()` function instead of constructor injection

## Git
- Commit and push only changes relevant to the task.
- Ignore changes from other tasks.