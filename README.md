# Grouper

Grouper is an Angular app for creating sessions and grouping people based on preferences.

## Demo

A live demo of the application is available at <https://grouper.kim-ipsen.workers.dev/>.

## Sample Data

Importable sample classes for testing and demos are described in [docs/sample-data.md](docs/sample-data.md).

## Repository Layout

- `grouper-app/`: main application (Angular 22, standalone components)
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

## Deployment

The app is deployed as a Cloudflare Worker serving static assets. `wrangler.jsonc` serves `grouper-app/dist/grouper-app/browser`, so build first, then deploy:

```bash
npm --prefix grouper-app run build
npx wrangler deploy
```

- `not_found_handling = "single-page-application"` makes page navigations serve `index.html`, while missing static files (for example a missing `.js`) still return 404.
- Unknown app paths are redirected to `/sessions` by the `**` route in the Angular router.
- Docker/nginx already falls back to `index.html` via `try_files`.
- Cloudflare project settings (the build command) live outside this repository. The Workers Builds project is assumed to run the Angular build before `npx wrangler deploy`; otherwise the assets directory is missing.

### Rollout

- After deploy, check the Worker URL: `/sessions` and `/session/abc` requested with `-H 'Sec-Fetch-Mode: navigate'` should return 200, and a missing `.js` file requested without that header should return 404.
- The Worker `name` in `wrangler.jsonc` (`grouper`) must match the Workers Builds project, or the build errors.
- A preview URL from a non-production branch build is an optional pre-merge check.
- Rollback: revert the pull request. The Workers dashboard can also roll back a deployment.

## Important Product Rules

- Session export includes only the latest 5 `groupingHistory` entries.
- Preference scoring is configurable per session:
  - `preferenceScoring.wantWith` (default `2`)
  - `preferenceScoring.avoid` (default `-2`)
- Custom weights are configurable per weight:
  - each custom weight has a `mode`: `balance` or `match-similar`
  - mode is set when the weight is created and can be changed later
  - weighted grouping uses the mode of each selected custom weight
  - legacy imported weights without `mode` default to `balance`
- Supported locales are English (`en`) and Danish (`da`).

## Key Source Folders

- Models: `grouper-app/src/app/models/`
- Services: `grouper-app/src/app/core/services/`
- Algorithms: `grouper-app/src/app/core/algorithms/`
- Session feature UI: `grouper-app/src/app/features/sessions/`
- i18n files: `grouper-app/src/assets/i18n/`

## Release Process

See [docs/release-process.md](docs/release-process.md).

Note: Documentation-only changes do not affect application behavior.
No-op note: repository workflow validation change.
