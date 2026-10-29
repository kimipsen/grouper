# DKFDS Component Decision Digest

Condensed English summary of the "when to use / don't use" rules from designsystem.dk
(DKFDS v11). Pages are in Danish at `https://designsystem.dk/komponenter/<slug>/`.
When a choice is close, read the live page; it wins over this digest.

## Quick decisions

| Need | Use | Not |
|---|---|---|
| Perform an action (save, submit, delete) | Button (`knapper`) | Link |
| Go to another page/view | Link / navigation | Button, dropdown |
| Small inline action inside content (edit, remove, open) | Function link (`funktionslink`) | Primary/secondary button |
| Page-level status, system error, confirmation in the page flow | Alert (`beskeder`) | Toast |
| Short transient feedback after a user action | Toast (`toastbesked`) | Alert, modal |
| Error on a specific field | Field error message (`fejlmeddelelser`) + error summary | Alert, toast |
| Any validation errors on submit | Error summary (`fejlopsummering`) at top | Only inline errors |
| Confirm a critical or irreversible action | Modal (`modal`) | Toast, alert |
| Pick 1 of 2–4 options | Radio buttons (`radioknap`) | Dropdown |
| Pick 1 of 5–15 options, space is tight | Dropdown (`dropdown`) | Radios if room |
| Pick 1 of >15 options | Text input with autocomplete | Dropdown |
| Pick several options | Checkboxes (`tjekboks`) | Multi-select dropdown |
| On/off that applies immediately | Toggle switch (`toggle`) | Checkbox |
| On/off that applies on save | Checkbox | Toggle switch |
| Show/hide related sections under headings | Accordion (`accordions`) | Nested accordions |
| One optional explanation the user may expand | Details (`detaljer`) | Accordion with one item |
| Multi-step flow | Step indicator (`trinindikator`) + pages | Accordion, modal |
| Self-contained topic, or navigation tile | Card (`cards`) | Grouping form fields |
| Compare values across columns | Table (`tables`) | Layout, single-column lists |
| Short contextual hint for a term or icon | Tooltip (`tooltip`) | Essential information |
| Status/category label | Tag / badge (`tags`, `badges`) | Buttons |
| Content is loading | Spinner (`spinner`) | Blank screen |

## Buttons — `knapper`
- `button` + one of `button-primary` (main action, **one per page**), `button-secondary`
  (other actions, several allowed), `button-tertiary` (subdued), `button-warning`
  (irreversible, serious consequences, e.g. delete; text must also convey severity).
- `xs-full-width`: primary only, small screens, single central action.
- `button-group` wraps related buttons. Icon in a button only if it clarifies the function.
- Icon-only (`button-icon-only` + `sr-only` label) only for widely known icons; prefer a function link.
- One function per button. Don't navigate with buttons.
- **Avoid disabled buttons**: low contrast, not focusable, users don't know why. Let users
  submit and show validation errors instead.

## Alerts — `beskeder`
- `alert alert-info|alert-success|alert-warning|alert-error`; `alert--paragraph` for text width;
  `has-close` + `alert-close` for dismissible (needs JS: `DKFDS.Alert`).
- Use for status, error summaries, confirmations, required-action warnings; place at top of a form.
- Don't use for: single-field errors, critical decisions (use modal), decorating static info,
  stacking several alerts, success messages inside modals.
- `role="alert"` when it appears dynamically (always for warning/error). Heading `h2`–`h4`/`strong` per context.
- Text: short, plain, terms the user knows; success says what happened and what's next.

## Toast — `toastbesked`
- Container `div.toast-container` (`aria-live="assertive"`, `aria-atomic="false"`,
  `aria-relevant="additions"`) as first child of `<main id="main-content">`.
- `div.toast toast-success|toast-warning|toast-error|toast-info`, starts with `hide` when
  JS-controlled; `new DKFDS.Toast(el).show()/hide()`.
- Use for short, relevant info in response to the user's current activity. Use sparingly.
- Don't use for: content belonging in the page (alert), field errors, critical actions (modal),
  long/critical text. **No links or other interactive content.** Auto-dismiss must satisfy WCAG 2.2.1.
- Newest toast on top.

## Modal — `modal`
- Use to confirm/approve an action or when you must be sure the user responds.
- Don't use: instead of pages, for long/scrolling content, frequently, on mobile, **for forms
  (especially >1 field)**. One modal at a time. User opens it themselves (only exception:
  session-timeout warning).
- Meaningful `h2.modal-title`, specific button labels, short text.
- Markup: `div.fds-modal-container` directly under `body` > `div.fds-modal` (`role="dialog"`,
  `aria-modal="true"`, `aria-hidden="true"`, `aria-labelledby`) > `.modal-content` >
  `.modal-header` / `.modal-body` / `.modal-footer`. Trigger: `data-module="modal"`,
  `data-target`, `aria-haspopup="dialog"`.
- `data-modal-forced-action` removes Escape/close; then the footer must offer a way out.
- JS: `new DKFDS.Modal(el).init()`, `.show()`, `.hide()`; events `fds.modal.shown|hidden`.
  The script makes the rest of the page `inert`. In Angular, the container must be a direct
  child of `body` — render it via a portal/`document.body.appendChild` or verify placement.

## Field error messages — `fejlmeddelelser`
- For helping complete individual fields: what's wrong + how to fix, polite and specific
  ("Indtast sessionens navn", not "Feltet er påkrævet"). Built from the field label so it
  stands alone in the error summary. Not for system errors (alert) or eligibility (own page).
- Message above the field, red left border; never colour alone.
- `div.form-group.form-error` > `label.form-label` + `span.form-error-message#id`
  (`<span class="sr-only">Fejl: </span>…`) + control with `aria-invalid="true"` and
  `aria-describedby="<error-id> <hint-id>"`. Groups use `fieldset` + `legend`.

## Error summary — `fejlopsummering`
- Show whenever there are input errors, even one. Top of page/step, above `h1` (below back link/breadcrumb).
- `nav[aria-labelledby]` > `div.alert.alert-error` (`role="alert"`, `data-module="error-summary"`)
  > `h2.alert-heading` + `ul.alert-text.nobullet-list` of `a.function-link` to field ids
  (radio/checkbox lists: first option). Link text = error message text.
- JS: `new DKFDS.ErrorSummary(el).init()`; move focus to the summary after a failed submit.

## Dropdown (select) — `dropdown`
- Only for 5–15 mutually exclusive options in tight space; <5 → radios; >15 → autocomplete;
  multiple → checkboxes. Never for navigation.
- Always labelled; pre-select only if most users choose that value; **no action on change**
  (add a button); no cascading dropdowns; don't disable — remove instead.
- `form-group` > `label.form-label` + `select.form-select`.

## Radio buttons / checkboxes — `radioknap` / `tjekboks`
- Radios: one choice among few options, all visible. Checkboxes: zero or more choices, or a
  single yes/no that applies on save.
- Wrap groups in `fieldset` + `legend`. Classes `form-radio` / `form-checkbox`.
- `radio-toggle-content` / `checkbox-toggle-content` reveal dependent fields (JS components).

## Toggle switch — `toggle`
- Only when the change applies **immediately**; otherwise checkbox + save.
- `button.toggle-switch[type=button][role=switch][aria-checked]`, label to the left, stacked
  toggles aligned; groups in `role="group"` + `aria-labelledby`. **No shipped JS**: bind
  `aria-checked` to a signal.

## Accordion — `accordions`
- Show/hide related content under visible headings; open the most important section by default.
- Don't: replace flow steps or pages, hide small content, collapse lists/search results, split a
  sequence (use step indicator), nest accordions, hide content just to shorten the page.
- `ul.accordion` > `li` > `h2-h5` > `button.accordion-button[aria-expanded][aria-controls]` +
  `div.accordion-content#id`. Error: `li.accordion-error` + error summary.
- JS: `new DKFDS.Accordion(ulEl).init()`; translate bulk "open/close all" texts via init options.

## Cards — `cards`
- Group content distinct from the rest of the page that stands on its own; navigation cards.
- Don't: hold the page's main content, decorate, group form fields, long scan lists (use long cards).
- One topic per card; title + text required; few links/buttons; equal heights in a row; don't
  mix navigation cards with other cards in one list.
- `card-row` + grid cols > `card` (`long` variant) > `card-image`, `card-content` >
  `card-subheading`, `card-heading`, text, `card-actions` (`button-group` / `nobullet-list`).

## Tables — `tables`
- For finding/comparing values across columns; not for layout, single parameter (list) or trends (chart).
- Right-align numbers with equal decimals. Header cells required.
- Variants: `table--borderless`, `table--zebra` (long tables), `table--compact`,
  `table--extracompact`, `table--responsive-headers` (+ `data-title` per `td`, `DKFDS.ResponsiveTable`),
  `table--selectable` (`DKFDS.TableSelectableRows`), wrapper `table--responsive-scroll`.
- Sorting: always one active sort, header buttons + `aria-sort`, no shipped JS.
- Structured list: 2–3 columns with `th scope="row"` for key/value summaries (e.g. session settings).

## Other components (read the live page before using)
| Slug | Component | Gist |
|---|---|---|
| `detaljer` | Details | Native `<details>` for optional extra explanation |
| `faneblade` | Tabs | Switch between parallel views of the same context; `DKFDS.Tabs` |
| `trinindikator` | Step indicator | Multi-step flows, one step per page |
| `funktionslink` | Function link | Secondary inline actions with icon (edit, delete, print) |
| `overflowmenu` | Overflow menu | Group extra actions when space is limited; `DKFDS.Dropdown` |
| `tooltip` | Tooltip | Short supplementary info; never essential content; `DKFDS.Tooltip` |
| `tags` / `badges` | Tags / badges | Status/category labels; not interactive unless designed as filters |
| `spinner` | Loading spinner | Indicate loading; announce with live region text |
| `inputfelter` | Input fields | Width classes match expected input length; hints via `form-hint` |
| `tekstomraade` | Textarea | Long text; character limit via `DKFDS.CharacterLimit` |
| `datovaelger` / `datofelter` | Date picker / fields | Known dates (birthdays) → date fields; near dates → picker |
| `search` | Search field | Site/list search |
| `paginering` | Pagination | Long result lists |
| `header` / `footer` / `skip-link` / `sprogvaelger` | Page chrome | Header, footer, skip link, language switcher (en/da) |
| `tilbage-link` / `broedkrumme` | Back link / breadcrumb | Orientation in flows / hierarchies |
| `fil-upload` | File upload | Attachments (e.g. session import) |
| `venstremenu` | Side menu | Sub-navigation within a section |
