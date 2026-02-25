# Grouper

Grouper is an Angular app for creating sessions and grouping people based on preferences.

## Repository Layout

- `grouper-app/`: main application (Angular 21, standalone components)
- `docs/`: project documentation and release notes

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   npm --prefix grouper-app install
   ```
2. Start the app:
   ```bash
   npm --prefix grouper-app start
   ```
3. Open `http://localhost:4204`.

## Common Commands

Run from the repository root unless stated otherwise.

- Start app: `npm --prefix grouper-app start`
- Build app: `npm --prefix grouper-app run build`
- Lint app: `npm run lint`
- Run unit tests: `npm --prefix grouper-app test -- --watch=false`
- Run accessibility specs: `npm --prefix grouper-app run test:a11y`

## Important Product Rules

- Session export includes only the latest 5 `groupingHistory` entries.
- Preference scoring is configurable per session:
  - `preferenceScoring.wantWith` (default `2`)
  - `preferenceScoring.avoid` (default `-2`)
- Supported locales are English (`en`) and Danish (`da`).

## Key Source Folders

- Models: `grouper-app/src/app/models/`
- Services: `grouper-app/src/app/core/services/`
- Algorithms: `grouper-app/src/app/core/algorithms/`
- Session feature UI: `grouper-app/src/app/features/sessions/`
- i18n files: `grouper-app/src/assets/i18n/`

## Release Process

See [docs/release-process.md](docs/release-process.md).
