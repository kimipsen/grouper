---
name: design-ui-ux
description: Design and implement Grouper UI/UX using Det Fælles Designsystem (DKFDS, designsystem.dk, npm package `dkfds`). Picks the right DKFDS component for each need (button vs link, alert vs toast vs modal, select vs radio vs checkbox, accordion vs page), applies DKFDS markup/classes in Angular templates, and checks accessibility (WCAG AA/AXE), i18n and responsive behavior. Use when designing, building, reviewing or reworking any screen, form, dialog, feedback message or layout.
---

# Skill: Design UI/UX with DKFDS

## Purpose
Make every UI decision in Grouper from Det Fælles Designsystem (DKFDS): first decide **which
component fits the user's need** (the "when to use" rules on designsystem.dk), then implement it
with DKFDS markup and classes, then verify accessibility, i18n and responsiveness. Custom CSS is
the last resort, not the starting point.

## Use This Skill When
- Designing a new screen, form, dialog, list or feedback message
- Changing layout, interaction flow or component choice on an existing screen
- Reviewing UI (PR review, UX audit) or replacing custom/Angular Material UI with DKFDS
- Unsure which component to use (e.g. "should this be a modal?", "toast or alert?")

## Sources (authoritative, in Danish)
- Components: `https://designsystem.dk/komponenter/<slug>/` (slugs in `references/components.md`)
- Styleguide: `https://designsystem.dk/styleguide/` (farver, typografi, layout, grid, ikoner)
- Patterns/templates: `https://designsystem.dk/eksempler/patterns/`, `.../eksempler/templates/`
- Accessibility + checklist: `https://designsystem.dk/kom-i-gang/tilgaengelighed/`, `.../kom-i-gang/tjekliste/`
- Code package: `https://designsystem.dk/kom-i-gang/implementering-kode/hent-kodepakken/`
- Installed source of truth for markup/classes: `grouper-app/node_modules/dkfds/`
  (`src/stylesheets/components/_*.scss`, `src/js/components/*.js`, `dist/img/all-svg-icons.svg`)

`references/components.md` is a condensed English digest of the "when to use / not use" rules.
When a decision is close, or a component isn't in the digest, fetch its designsystem.dk page and
read the **Retningslinjer / Hvornår skal man bruge** section. Translate Danish guidance for the
user; never paste Danish design-system text into the app (all UI text goes through i18n).

Useful Danish terms: *knap* button, *besked* alert, *toastbesked* toast, *fejlmeddelelse* field
error, *fejlopsummering* error summary, *tjekboks* checkbox, *radioknap* radio, *faneblade* tabs,
*trinindikator* step indicator, *detaljer* details, *funktionslink* function link,
*retningslinjer* guidelines, *brug / brug ikke* use / don't use, *påkrævet* required.

## How DKFDS Is Wired In This Repo
- Package `dkfds` (v11) in `grouper-app/package.json`; `angular.json` copies
  `node_modules/dkfds/dist` to `assets/dkfds/dist`.
- Theme: `src/index.html` links `assets/dkfds/dist/css/dkfds-borgerdk.css` (borger.dk theme).
  Don't switch theme or add a second DKFDS stylesheet without being asked.
- JS: `src/main.ts` calls `DKFDS.init()` **once** after bootstrap. Angular renders most
  components later (routes, `@if`, `@for`), so DKFDS JS components (modal, accordion, toast,
  tabs, error summary, tooltip, alert close, responsive/selectable table...) must be initialised
  per instance: e.g. in the component, `afterNextRender(() => new DKFDS.Modal(el).init())` using
  a `viewChild` element ref. Never call `DKFDS.init()` again, and never init the same element twice.
- `src/dkfds.d.ts` only declares `init`. When you use a component class, extend that declaration
  with a minimal typed signature (no `any`). Exports available: `Accordion, Alert, BackToTop,
  CharacterLimit, CheckboxToggleContent, Dropdown, DropdownSort, datePicker, ErrorSummary, Modal,
  Navigation, MenuDropdown, RadioToggleGroup, ResponsiveTable, TableSelectableRows, Tabs, Toast, Tooltip`.
- Components with **no shipped JS** (toggle switch, table sorting/search/pagination): implement
  the behaviour with signals and keep ARIA state (`aria-checked`, `aria-sort`, ...) bound.
- Icons: `<svg class="icon-svg" focusable="false" aria-hidden="true"><use href="assets/dkfds/dist/img/all-svg-icons.svg#<icon-id>"></use></svg>`.
  Look up ids in `dist/img/all-svg-icons.svg`. Icon-only controls need an `sr-only` text label.
- Existing deviations to be aware of: `MatSnackBar` (Angular Material) is used for transient
  feedback, which is the DKFDS **toast** role, and `src/styles.scss` sets a custom body background.
  When touching those areas, propose the DKFDS replacement (AGENTS.md: minimal disruption).
- Classes already in use: `button button-primary|secondary|tertiary|warning`, `button-group`,
  `form-group`, `form-label`, `form-input`, `form-select`, `form-checkbox`, `card`,
  `card-content`, `card-heading`, `card-subheading`, `card-actions`, `header`.
  Reuse these before adding anything new.

## Workflow

### 1. Frame the UX problem
State in one or two lines: who the user is (a teacher/organiser managing sessions and groups),
what task they are completing, and what outcome the screen must produce. List the states the UI
needs: default, empty, loading, error, success, and (for lists) one item / many items.

### 2. Choose components with the DKFDS decision rules
For each need, pick the component using `references/components.md` (and the live page when in
doubt). Record the choice and the rule that drove it, for example:
- "Delete session → `button-warning` + forced-action-free confirmation **modal** (irreversible action)."
- "Saved settings → **toast** success, not alert (transient response to user action)."
- "Pick 1 of 3 grouping strategies → **radio buttons**, not select (fewer than 5 options)."

If the requested UI conflicts with DKFDS (e.g. a multi-field form in a modal, disabled submit
button, dropdown that acts on change), explain the tradeoff and propose the closest DKFDS-
compliant alternative **first** (AGENTS.md requirement), then do what the user decides.

### 3. Design the layout
- Use the DKFDS grid (`container`, `row`, `col-12 col-md-6`, ...) and spacing utilities
  (`mt-*`, `mb-*`, `p-*`) instead of component SCSS where possible. Component SCSS budget is
  4 kB warn / 8 kB error.
- One `h1` per page, heading levels in order; headings inside components (accordion, card,
  alert) must fit the surrounding outline.
- One primary button per page/view. Actions read left-to-right: primary first, then secondary.
- Mobile first: check ~375 px width. Use `xs-full-width` for a single central primary action on
  small screens. Avoid modals on mobile flows; prefer a page or inline section.

### 4. Implement in Angular (repo conventions)
- Standalone components, `ChangeDetectionStrategy.OnPush`, `input()`/`output()`, signals and
  `computed()`, native control flow, `class` bindings (no `ngClass`/`ngStyle`), reactive forms.
- Apply DKFDS markup exactly (wrapper classes, ARIA attributes, `id`/`for`/`aria-describedby`
  wiring). Generate unique ids per component instance for labels, hints and error messages.
- Form errors: `form-group form-error` wrapper, `span.form-error-message` with `sr-only` "Fejl:"
  prefix (translated), `aria-invalid="true"` and `aria-describedby` on the control, plus an
  **error summary** at the top on submit, with links that move focus to the fields.
- All visible text, `aria-label`s and `sr-only` texts are i18n keys added to **both**
  `src/assets/i18n/en.json` and `da.json` with identical key structure and placeholders.

### 5. Verify
- Accessibility: keyboard-only walkthrough (tab order, visible focus, Escape closes modal, focus
  returns to the trigger), colour is never the only signal, contrast meets WCAG AA, every control
  has an accessible name. Add/extend `*.a11y.spec.ts` (see the `create-tests` skill).
- Run `cd grouper-app && npm test -- --watch=false`.
- Visual check in the running app on desktop and mobile widths (the `generate-screenshots`
  skill can capture them).
- Walk the DKFDS checklist: `https://designsystem.dk/kom-i-gang/tjekliste/`.

## Output When Asked To Design (Not Build)
Give a short design brief: user goal, screen states, component choices with the DKFDS rule
behind each, layout sketch (ASCII is fine), accessibility notes, new i18n keys, and open
questions. Keep it implementation-ready.

## Review Checklist (UI PRs)
- [ ] Every component choice matches its DKFDS "when to use" rule; no custom widget where a DKFDS component exists
- [ ] DKFDS markup/classes and ARIA match the component page; JS components initialised once per instance
- [ ] At most one primary button per view; warning buttons only for irreversible actions
- [ ] No disabled buttons/selects used to block progress; explain with validation instead
- [ ] Field errors inline + error summary; alerts for page-level status; toasts only for transient feedback
- [ ] Empty, loading, error and success states exist
- [ ] Works at mobile width; no horizontal page scroll (tables may scroll inside `table--responsive-scroll`)
- [ ] Keyboard, focus management, contrast and accessible names pass WCAG AA / AXE
- [ ] All text via i18n keys in both `en.json` and `da.json`
- [ ] Tests updated and `npm test -- --watch=false` passes
