# UI components and styles

How the site is styled: shared components in `src/components/ui/`, each component's own CSS module, a small global stylesheet, and the text halo that keeps words readable over the background.

## Where styles live

- **In the component's CSS module.** Every component that has styles of its own has a `.module.css` file beside it (`Button.tsx` and `Button.module.css`), and styles only its own elements. A rule doesn't reach into another component's elements by their classes: CSS modules give each class a name of its own, so it can't.
- **The global stylesheet is small.** `src/styles.css` has only what every page shares: the font, the tokens (colours, the display font, the card's paper), base styles for plain elements (`a`, `button`, focus rings), the text halo, `.app-root`, `.visually-hidden`, and the reduced-motion override. There's no other global class. A unit test (`src/test/no-global-classes.test.ts`) fails on a `className="…"` string anywhere else, apart from the frame art in `src/components/frames.tsx`, whose `fill` and `faint` classes are read by the link preview's drawing too ([share-previews.md](share-previews.md)).
- **Tokens, not copies.** A colour used in more than one place is a custom property in `styles.css` (`--accent`, `--cream`, `--ink`, `--surface`, `--paper-background`…), so the same thing is the same colour everywhere.
- **Placing a component is its parent's job.** A component sets how it looks, not where it sits: its margins above and below, or its place in a grid, come from the parent, through `className`. A component only sets properties a parent won't also set, so which of the two stylesheets loads first never matters. Where they would clash, the parent wraps it instead (as the plan page does its `PlanBar`), or uses a more specific selector (`.links > a`).

## Hooks for code and tests

Class names from CSS modules change from build to build, so neither code nor tests select elements by them. They use a role or label where there is one (`getByRole('region', { name: 'Your plan' })`), and otherwise a `data-*` attribute that's there for the purpose:

| Attribute | On | Used by |
| --- | --- | --- |
| `data-card-grid` | every `CardGrid` | `useGridShuffle` |
| `data-shrinks` | the builder's sections that shrink on a narrow screen | `shrinkOf`, `PlanBuilder`'s `--layout-height` |
| `data-builder`, `data-column="deck" \| "plan"` | the builder, and each of its columns | tests, `expectStill` |
| `data-plan-row`, `data-card-id`, `data-deck-card-id`, `data-group-id` | the plan's rows, and cards and groups | the drag, flights, tests |
| `data-plan-scroll`, `data-plan-bar`, `data-plan-actions`, `data-bar-content`, `data-plan-prompt`, `data-random-pick`, `data-group-add`, `data-empty-slot`, `data-add-card-controls` | parts of the builder | tests |
| `data-hero`, `data-site-header` | a page's big title, the site's header | the stars and the header (see [Page frame](#page-frame)) |
| `data-galaxy`, `data-sparkle`, `data-stars` | the background and its sparkle, the stars | tests |
| `data-variant` | every `Button` | `Form`, to centre a text button under the rest |

## The text halo

Text sitting on the galaxy background has a soft dark halo, so it stays readable over its busier parts. Text on anything with a background of its own (a panel, a dialog, a card, a chip, a field) doesn't.

- **Everything gets it, unless it's on a surface.** Every element's `text-shadow` is `var(--text-halo)` (a rule on `*` in `styles.css`), and `--text-halo` is the halo. A component with a background of its own sets `--text-halo: none` on itself. It's an inherited custom property, so everything inside it, whatever it is, has no halo, with nothing to undo.
- **Surfaces say so themselves.** `Panel`, `Dialog`, `Chip`, `Button` (solid), `Input`/`TextArea`, `EmptySlot`, `DeckList`'s tiles, `InstallHint`, the card, and the back of a card in its notes all set `--text-halo: none`. A new component with a background of its own should too; one without needs nothing.
- **Underlines are opaque.** Safari draws an underline in the wrong place on text with more than one text shadow when the underline is see-through, so underlines use `--underline`, an opaque mix of the accent and the background.

## Links and buttons

There are two looks, both from `Button` (`src/components/ui/Button.tsx`), which is a `<button>`, or a link when it has an `href`:

- **Solid** (`variant="solid"`, the default), filled with the accent, for the main thing to do: **Save plan**, **Create deck**, **Copy link**.
- **Text** (`variant="text"`), which reads as a link: the accent, with a faint underline that firms up on hover. For everything else: **Cancel**, **Delete deck**, **Add an idea**, **Draw random card**. With `tone="subtle"` it's cream until hovered, as in the site's header.

A plain link in a sentence (`<Link>` or `<a>`, like **Make an account** under the sign-in form) looks the same as a text button, from the `a` rule in `styles.css`. A link given `native` is a plain `<a>` the browser follows itself, rather than Next's `Link`.

## The components

In `src/components/ui/`:

| Component | What it's for |
| --- | --- |
| `Button` | See [Links and buttons](#links-and-buttons). |
| `CloseButton` | The small cross that closes a dialog or puts a notice away. |
| `Dialog` | A modal dialog: `open` and `onClose`, and `size` (`small`, centred, for a message and a few buttons; `form`; `wide`, for a form with a preview beside it). With `closeButton` it has a cross in its corner. It opens with `showModal`, so Escape closes it and calls `onClose`. |
| `Panel`, `PanelFootnote` | A box with its own background for a form or a message, `narrow` for a page that's mostly the panel. It styles the prose inside it (paragraphs, `h3`, `hr`). |
| `Heading`, `Subheading` | Headings in the display font: `size="section"` for a page's own heading beside its actions, `size="panel"` for a panel or dialog. `Subheading` heads part of a page, with a count after it (**Ideas (12)**). |
| `Hero`, `Lede` | A page's big title, with anything under it, and a larger line or two introducing the page. |
| `PageSection`, `SectionHeading`, `SectionActions` | The main part of one of the app's own pages, its heading with actions beside it, and a few buttons side by side. |
| `Form`, `FormStack`, `FormActions`, `Field`, `Input`, `TextArea`, `FormError`, `FormNote`, `ChoiceGroup`, `Choice` | Forms: fields and buttons in a column, a field with its label and hint, the text boxes, why something didn't work (nothing when there's nothing to say), a note on how it went, and radio buttons with a line saying more. |
| `ChipGroup`, `Chip` | A row of on-or-off buttons, like the deck's filters and the card form's tags. |
| `Divider` | A small spaced-out word, like **or**, between two rules. |
| `ItemList`, `ItemRow` | A list of things, one to a line, each with its actions at the end. |
| `EmptySlot` | A dashed outline where a card could go. |
| `EmptyResults` | Where a list or grid would be when there's nothing in it. |
| `Muted` | Text that steps back from what's around it. |

Outside `ui/`, shared by more than one page: `PageShell` (the page's column, with the stars behind it), `SiteHeader`, `SiteFooter`, `CardGrid` ([card-layout.md](card-layout.md) § "The grid of cards"), `PlanBar` and `PlanActions` (the plan's buttons, in the builder and on the plan page), `PlanGroupSection` and `PlanGroupEditor` (a group on the plan page, and in the builder).

## Page frame

Every page is in a `PageShell`, which draws the scattered stars behind it. A page with a big title uses `Hero`, which is marked `data-hero`. The app's own pages have the `SiteHeader` above them, marked `data-site-header`.

- **The header leaves out the site's name** when a `Hero` follows it, as the title already says it (the home page).
- **The first star moves** out of the way of the header, or of a big title.

Both look for the mark with `:has()`, rather than for the other component's class.
