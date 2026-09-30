# Component-based styling refactor

## Context

Nearly all styling lives in the 1,660-line global `src/styles.css`, keyed by global class names (`done-button`, `text-action`, `panel`, `share-dialog`, `plan-track`…) that are repeated by hand across about 40 TSX files. That causes:

- **Hidden coupling.** Rules reach into other components (`.panel .text-action`, `.form > .text-action`, `.plan-column .plan-group-info`, `.page-shell:has(.hero) .site-header`), and tests and code select by those class names (`shrink.ts`, `gridShuffle.ts`, about 40 e2e and unit selectors).
- **A fragile text halo.** `--background-text-shadow` is applied to a hand-kept list of 15 selectors, then removed again with `text-shadow: initial` inside dialogs and panels, and `.muted:not(.panel *, dialog *)`.
- **Drift.** Similar things look different for no reason. "Add an idea" has no underline until hover, while other text actions have a faint one. Prose links use the browser's full underline. There are two near-identical "or" dividers, two identical X buttons (share dialog and InstallHint), the same card paper background in both `Card.module.css` and `CardNotes.module.css`, and near-duplicate colours (`#173847`, `#183745`, `#173d4c`; panel background at 0.9 against dialog at 0.96…).
- `PlanBuilder.tsx` is about 1,080 lines, rendering the bar, filters, deck, plan column and groups inline.

**What this refactor delivers:** reusable components, each with a co-located CSS module. `styles.css` keeps only tokens, resets and base elements. The halo becomes a property of surfaces, and similar controls behave the same.

**Decisions already made with you:**
- **The halo:** surfaces switch it off (see below).
- **Nav links:** get the standard underline but keep their cream colour, as a `subtle` tone.
- **PlanBuilder:** is split into components.

## Approach

### 1. Global layer: `src/styles.css`, shrunk to about 200 lines

It keeps only the following:
- `@font-face`; the `@property` registrations (`--columns`, `--shrink`, `--fade-*`); the reduced-motion override; `.visually-hidden`; `.app-root`.
- **Tokens** on `:root`. The existing ones (`--accent`, `--line`, `--underline`, `--background-color`, `--defocused-background-color`), plus new ones that consolidate the ad-hoc values:
  - `--cream` (#f8f2e8), `--cream-soft` (rgba 255,249,239 at .85), `--cream-faint` (.42)
  - `--ink` (merging #173847, #183745 and #173d4c)
  - `--surface` (panel and dialog background, one alpha); `--scrim`
  - `--accent-hover` (#f0d3a8); `--danger` (#ffb4a2)
  - `--focus-ring`
  - `--font-display` ('Tan Pearl', Georgia, serif)
  - `--paper` (the card's layered background, used by both Card and CardNotes)

  A merged value keeps a separate token only where there is a visible reason for it.
- **The halo:**
  ```css
  :root { --text-halo: <the current 9-shadow value>; }
  *, *::before, *::after { text-shadow: var(--text-halo); }
  ```
  Every component with its own background sets `--text-halo: none` on its root: Panel, Dialog, Card, the back of CardNotes, InstallHint, DeckTile, Chip, solid Button, inputs, EmptySlot. Because it's an inherited custom property, everything inside a surface loses the halo without any overrides. The selector list and every `text-shadow: initial` or `:not(.panel *)` go. Component rules that set their own shadow (the card's `.action`) still win, since `*` has zero specificity. The comment by `--underline` about Safari's multi-shadow underline stays with the token.
- **Base elements:** `body`, `button { font: inherit; color: inherit }`, `:focus-visible` using `--focus-ring`, and the `a` base, which is the standard link look:
  - accent colour
  - a 1px `--underline`, offset 0.25em
  - `currentColor` on hover

  Inline prose links (sign-in and request-page footnotes, "your decks") then match with no component needed.

### 2. Shared primitives: new `src/components/ui/`

Each is `X.tsx` plus `X.module.css`. This directory has a rule of its own, so it goes in AGENTS.md.

| Component | Replaces | Notes |
|---|---|---|
| `Button` (`variant: 'solid' \| 'text'`, `tone?: 'subtle'`, `href?`) | `.done-button`, `.text-action`, `.add-card`, `.site-links a` | Renders Next `Link` when `href` is given (external links pass `target`). The text variant is the standard faint-then-solid underline, so "Add an idea" is `variant="text"` at its larger size. The `subtle` tone is cream and goes to accent on hover, for the nav. Solid sets `--text-halo: none`. Handles `disabled`/`pending`. |
| `Dialog` (`open`, `onClose`, `size: 'small' \| 'form' \| 'wide'`, `closeButton?`, labelling props) | `.share-dialog` + `form-dialog`, `quick-add-dialog`, `editor-dialog`, and the `showModal` `useEffect` copied into CardEditor and QuickAdd | Controlled. SharePlanButton and NewDeckButton move to state. It's a surface. |
| `CloseButton` | `.share-dialog-close`, InstallHint `.dismiss` | The same X icon button. |
| `Panel` (`narrow?`) | `.panel`, `.panel.narrow`, `.panel-footnote` (a `Panel.Footnote`), `.panel hr`/`h3`/`p` | It's a surface. |
| `Heading` (`level`, `size: 'page' \| 'section' \| 'panel' \| 'group'`) + `Subheading` | `h1`, `.section-heading h2`, `.panel h2`, `.share-dialog h2`, `.plan-heading`, `.plan-group-heading`, `.subheading` | One place for the display font and its sizes. |
| `Hero` (title, lede) + `Lede` | `header.hero`, `.lede` | Sets `data-hero`, which SiteHeader and the stars read (see §3). |
| `Form`, `Field` (label, hint, control), `FormError`, `FormNote`, `ChoiceGroup`/`Choice` | `.form`, `.field`, `.form-error`, `.form-note`, `.choice*`, global `input`/`textarea` rules | Input styles live in `Field.module.css`. The plan group's bare title and notes inputs keep their own module. |
| `Divider` (`label`, `tone`) | `.or-divider`, `.empty-slot-divider` | One component. |
| `ChipGroup` (label, children) + `Chip` (`pressed`) | `.filters`, `.filter-label`, `.filter-button`, `.tag-picker`, `.sort-options` | Used by the deck's filters and sort, and by CardEditor's tags. `Chip` is a surface. |
| `Muted` | `.muted` | Just the opacity. The halo now comes from wherever it sits. |
| `ItemList` / `ItemList.Row` | `.plan-list`, `.passkey-list` rows | |
| `EmptySlot` (`compact?`) | `.empty-slot`, `.group-slot` | The dashed card-sized slot. It's a surface. |

### 3. Feature and layout modules

Everything below moves out of `styles.css`:

- **Page frame:**
  - `PageShell` (`.page-shell`) + `Stars.module.css`.
  - `SiteHeader.module.css` (header, brand, links through `Button tone="subtle"`) and `SiteFooter`.
  - Today the header hides its brand, and star 1 moves, through `:has(.hero)` / `:has(.site-header)`. Those become `:has([data-hero])` / `:has([data-site-header])`: explicit attribute hooks rather than another component's class names.
- **Card grids:** `CardGrid` (+ module) replaces the shared `.card-grid, .plan-column .plan-track` rule. Its `stack` prop covers the plan column's single column on wide screens. It sets a `data-card-grid` attribute, which `gridShuffle.ts` queries in place of `.card-grid, .plan-track`.
- **Decks:**
  - `DeckTile` (+ module) and `deck-list` → `decks/DeckList`.
  - `DeckEditor.module.css` takes the section heading, rename form, share panel and share row.
  - `AddCardControls.module.css`.
  - `CardEditor.module.css` takes the editor layout and preview.
- **Cards:** `Card.module.css` and `CardNotes.module.css` use the `--paper`/`--ink` tokens rather than their own copies. `frames.tsx`'s global `fill`/`faint` classes become classes from a `frames.module.css` import, which removes Card's `:global(.fill)`.
- **Background:** `GalaxyBackground.module.css` takes `.galaxy-*`. `sparkle.ts` imports the class names from it. Tests switch to `data-galaxy-*` attributes.
- **Plan page:** `PlanView`'s groups use the shared `PlanGroup`, with `variant="page"` or `variant="builder"`. This replaces the `:not(.plan-column *)` / `.plan-column .plan-group-info` overrides.

### 4. Splitting PlanBuilder

Split into `src/components/builder/`: `PlanBuilder.tsx` (state and orchestration), `BuilderBar` (with `BarFade`), `DeckFilters` (two `ChipGroup`s), `DeckColumn`, `PlanColumn`, `PlanGroup`, `ColumnSwitch`, and `PlanBuilder.module.css`.

- **What PlanBuilder.module.css keeps:**
  - the `.builder` grid
  - the narrow-screen shrink rules (`--shrink`, `--layout-height`, `data-active`, `data-switching`)
  - `--scrollbar-gutter`
  - the plan column's scroll fade
- **How the shrink rules reach child sections:** through data attributes, not class names. Each section that shrinks carries `data-shrinks`, and its column carries `data-column="deck" | "plan"`. The rules become `.builder[data-active='deck'] [data-column='plan'] [data-shrinks]`. `shrink.ts` and the `--layout-height` measuring in PlanBuilder query `[data-shrinks]`.
- **Existing hooks are reused:** `data-plan-row`, `data-card-id`, `data-deck-card-id` and `data-group-id` already exist, and replace `.plan-track`-style selectors wherever they fit.

### 5. Tests

Hashed module class names break every `.class` selector in tests, so each one moves:
- to a role or name where there is one, e.g. `getByRole('region', { name: 'Your plan' })` for `.plan-section`;
- otherwise to the `data-*` hook introduced above.

Affected files:
- **e2e:** `builder-layout`, `builder-stress`, `builder-scrollbars`, `plan-grouping`, `plan-editing`, `deck-editing`, `flow`, `background`.
- **Unit:** `PlanBuilder.layout`, `.deck`, `.reduced-motion`, `GalaxyBackground`.

New tests, with doc citations:
- **Halo**, in a jsdom or e2e test: text on the background has the halo; text inside a Panel, Dialog or Card has none.
- **Underline:** `Button variant="text"` has a faint underline at rest and a solid one on hover, in e2e, covering "Add an idea".
- **Dialog:** opens and closes when `open` changes and calls `onClose` on Escape.
- **Button:** with `href` renders a link.
- **ChipGroup/Chip:** `aria-pressed`.
- **Guard:** a unit test (`src/test/no-global-classes.test.ts`) fails on any `className="…"` string literal in `src/**/*.tsx`, apart from an allowlist (`app-root`, `visually-hidden`), so new global classes don't creep back in.

### 6. Docs

- **New `docs/ui-components.md`:**
  - the component catalogue and when to use each;
  - the surface/halo rule ("anything with its own background sets `--text-halo: none`");
  - the tokens;
  - the link and underline standard;
  - the data-attribute hooks as the contract between components, CSS and tests.
- **Updates:** `docs/card-layout.md` (the `.builder`, `.card-grid` and `styles.css` references, the file paths after the split), `docs/background.md` (the `.galaxy-*` location), `docs/testing.md` (select by role or `data-*`, never by module class names), and the comment in `src/lib/og/preview.tsx` (the `--background-text-shadow` name).
- **AGENTS.md:** a row for the new doc, and a convention paragraph: component styles go in co-located CSS modules, shared pieces come from `src/components/ui/`, and no new global classes. Also update the paths in the `card-layout.md` row (`PlanCard`, `PlanBuilder` move to `builder/`).
- **This plan** copied to `docs/historical-plans/2026-09-29-component-styles.md`.

## Order of work

Each step leaves the app working, passes the full test run and is its own commit.

1. Take baseline screenshots (see Verification).
2. Tokens and halo mechanism in `styles.css`, with surfaces setting `--text-halo: none`. Delete the selector list and the resets.
3. `ui/` primitives (Button, Dialog, CloseButton, Panel, Heading, Form bits, Divider, Chip, Muted, ItemList, EmptySlot), then migrate the call sites file by file and delete the matching global rules.
4. Page frame, decks, cards and background modules (§3).
5. PlanBuilder split and CardGrid, with the data-attribute hooks and the test selector changes (§4 and §5).
6. The guard test, docs, AGENTS.md, and the historical-plan copy.

## Intended visual changes

Anything else that shows up in the screenshots is a bug.

- "Add an idea" gets the faint underline, solid on hover.
- Inline prose links (footnotes, request page) get the faint underline in place of the browser's full one.
- Nav links: the underline goes solid on hover. They stay cream, and still turn gold on hover.
- Merged colours: ink, and the panel/dialog alpha if merged. These should be imperceptible.

## Verification

- `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e`.
- **Visual check:** a Playwright script kept in the scratchpad, not the repo. It takes screenshots before step 2 and after each step, at 1280px and 390px, of:
  - `/`, `/sample` (deck in use and plan in use, with a card picked and a group added), sign-in, sign-up, `/decks`, a deck editor with the card-editor, Quick Add and New deck dialogs open, and `/p/…` with the share dialog open.

  Compare them pixel by pixel. The only differences should be the intended changes above, and especially no halo appearing on or disappearing from any text.
- Manual check in Safari: underlines on text actions (the multi-shadow bug) and the narrow-screen shrink switch.

---

_Post-implementation note (2026-09-30, Claude, at Callum Gare's request): how the work departed from the plan above._

- `PlanBuilder.tsx` stayed in `src/components/` (with its tests beside it), to keep the churn down. Only its parts moved into `src/components/builder/` (`BuilderBar`, `DeckFilters`, `BuilderColumn`). The group editor went into `src/components/PlanGroup.tsx`, beside the plan page's group, which shares its styles.
- `CardGrid` has no `stack` prop; it's called `stacked`. `PlanBar` and `PlanActions` (in `src/components/PlanBar.tsx`) took the place of the builder bar's shared styles. `PageSection` and `DeckList` were added for the app's own pages.
- The frame art in `frames.tsx` keeps its global `fill` and `faint` classes: the link preview's drawing reads them by name (`src/lib/og/card.tsx`), so the guard test allows that one file.
- The dialogs are all one width for forms (`size="form"`, 460px, the same as a narrow panel), where New deck and Quick Add had been 440px and 480px.
