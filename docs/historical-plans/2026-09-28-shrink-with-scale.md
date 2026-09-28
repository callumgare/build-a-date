# Shrinking a column with a transform, not zoom

## Problem

On a narrow screen the column not in use is shrunk to a fifth of its size (docs/card-layout.md § "Narrow screens"). It was CSS `zoom: 0.2`. In Safari the cards in it looked far smaller than they should, next to their text, where Chrome and Firefox drew a faithful miniature.

An earlier fix (`zoomedContainerUnits.ts`, `--unzoom`) assumed Safari was multiplying container units (`cqw`) by the zoom a second time. That's true of the WebKit Playwright runs (26.6), but not of Safari 26.2, where the check didn't fire, so the fix did nothing.

Measured in Safari 26.2, under `zoom: 0.2`:

- Every font size comes out at 45px in the column's own units, whatever was asked for: `18px`, `1.1rem`, `clamp(…)`, all of them. 45 × 0.2 = 9: WebKit's "smart" minimum font size (`minimumLogicalFontSize`, 9 on macOS Safari) won't draw text under 9px on screen when the page asked for 9px or more. It doesn't apply in Playwright's WebKit, Chrome or Firefox.
- So every card's text was two to four times too big, `useFitText` shrank it as far as it would go (`--title-fit` 0.5, `--fit` 0.6), and it still overflowed.
- `cqw` in a width inside the zoomed column is right in 26.2 and doubled in 26.6; in a font size it's wrong in both, in ways that depend on the version and on whether it's inside `calc()`/`clamp()`.

Nothing inside a zoomed element can get under the minimum: only SVG text is exempt. A registered `<length>` custom property holding `1cqw` made things worse in every engine, Firefox included.

## Options considered

1. **Counter-zoom each piece of text**: `zoom: 1 / shrink` on each text element, its sizes multiplied by `shrink`, so its effective zoom is 1. Works (checked in 26.2), but has to reach every text element in both columns, not just cards: filters, headings, group titles, **Drag ideas here**. New text would bring the bug back.
2. **Hide the text in a shrunk column in Safari.** Cheap, but Safari's miniature wouldn't match other browsers'.
3. **Shrink with a transform.** A transform doesn't change computed font sizes, so the minimum never applies, and `cqw` is plain layout. But a transform doesn't make the element take up less room, which is why `zoom` was used.

Chose 3.

## Design

- `--shrink` (already registered, `<number>`) is the single animated value: 1 in use, 0.2 shrunk, transitioned on the same curve as the grid's columns.
- While a column is shrunk, or while either is growing or shrinking (`.builder[data-switching]`): `width: calc(100% / var(--shrink))`, `scale: var(--shrink)`, `transform-origin: 0 0`, and `margin-bottom: calc(var(--layout-height) * (var(--shrink) - 1))`, which takes back all but the drawn height. A column in use at rest has none of it, so it isn't a stacking context or a containing block for anything in it.
- `PlanBuilder` keeps `--layout-height` on each section (the plan's title, the plan, the deck) with a `ResizeObserver`, set before paint. The plan's title falls back to `1lh + 16px` (a line and its padding) until the script runs, since the plan is shrunk when a narrow page first opens.
- `shrinkOf` (`src/components/shrink.ts`) measures how much a column is shrunk: its section's drawn width over its laid-out width. It replaces reading `zoom` or `currentCSSZoom` in `deckAnchor`, `FlyingCard` and `gridShuffle`.
- `unshrinkSlide` stays: Motion's layout animations don't correct for a transform on an ancestor any more than for zoom.
- `zoomedContainerUnits.ts`, `--unzoom` and the attribute it set are removed.

## Tests

- `e2e/safari-layout.spec.ts`: a shrunk deck's text, as drawn on screen, is the same share of its card as in use, with the same columns. Measured from text ranges, not computed font sizes, so a minimum font size in any engine would fail it. (Playwright's WebKit doesn't apply Safari's minimum, so this was also checked by hand in Safari 26.2.)
- `e2e/builder-layout.spec.ts`: a shrunk deck takes up only a fifth of its height on the page. The switch tests check `scale` and a transition on `--shrink` rather than `zoom`.
