# Plan column: PlanBuilder with the plan beside the deck

Frozen plan, 2026-09-27. Not updated as the code moves on; see
[docs/card-layout.md](../card-layout.md) for how it works now.

## The ask

- Rename the `DeckBuilder` component to `PlanBuilder`.
- Instead of the plan's cards in a track across the top and the deck under
  it, put the plan in a thin column on the left, running down, and the deck
  on the right.
- Below a certain screen width, only one column is "active". The inactive
  one has everything in it shrunk to about 20%. A click anywhere on the
  inactive column activates it and deactivates the other.

## Decisions

- **The plan column sticks and scrolls on its own.** A thin column that just
  flowed down the page would be far shorter than the deck and scroll out of
  sight as soon as someone went looking for ideas. Sticky, with the window's
  height as its most, keeps the plan in view while picking. It also gives
  the drag one scroller to deal with in place of one per row.
- **Rows run down the column.** Each row (the first row and each group) is a
  vertical list, and groups stack under it. A group's title and notes go
  above its cards, with Remove group under them, because the column is too
  thin for anything beside them. The plan page (`/p/…`) keeps its horizontal
  tracks and side-by-side group titles, so the 900px group rules are scoped
  away from `.plan-column` rather than rewritten.
- **The drag goes by vertical middles.** `findPlace` compares the stand-in's
  vertical middle with the cards' `offsetTop` middles. Edge scrolling moves
  the plan column (clipped to the window) rather than a row. While the end
  being dragged towards is out of the window (the column hasn't stuck yet),
  the page scrolls instead. `edgeScrollSpeed` is unchanged, since it's
  already just spans.
- **The keyboard steps through the plan.** With rows stacked in one column,
  up/down "along the row" and up/down "onto another row" can't both be the
  arrow keys. `moveCardBy` is replaced by `stepCard`: one place up or down,
  crossing onto the top of the next row or the bottom of the previous one,
  so every group is reachable. Left and right do the same, so nothing
  surprising happens with them.
- **Shrinking is CSS `zoom: 0.2`, not `transform: scale`.** Zoom changes
  layout, so a shrunk deck really is a fifth of the height and the strip is
  really 64px wide. A transform would leave the full-size box behind. The
  column in use is `data-active` on `.builder`, and the media query and that
  attribute alone decide the layout, so server-rendered HTML is right before
  hydration. The script only adds the switch buttons and `inert`.
- **A shrunk column is covered by a button.** "Click anywhere" is a
  transparent button over the whole column (`ColumnSwitch`), labelled
  **Show your plan** or **Show the date ideas**, and the column underneath is
  inert. That swallows the click, so a tap on a tiny card never discards it,
  and it gives keyboard and screen reader users one sensible control in
  place of dozens of unreadable ones.
- **No Motion layout animations in a shrunk column.** Motion measures with
  `getBoundingClientRect` and applies transforms in the element's own,
  zoomed, space, so animations inside a zoomed column come out at a fifth of
  the right distance. Cards there get `layout={false}` and no `layoutId`. A
  switch between columns resizes every card at once, so it bumps the
  `LayoutGroup` key (the same trick kept picks use) and nothing animates.
- **The flying card scales its target.** `FlyingCard` still measures the slot
  from offsets, because the slot may have a layout transform on it. It
  scales them by the row's drawn width over its `offsetWidth`, which is
  right whether or not a browser's offsets account for zoom. It scrolls the
  plan column, not the track, to show the slot.
- **The deck's scroll is put back.** Shrinking the deck makes the page much
  shorter, which throws away the place in the deck. The page's scroll is
  saved when the plan is put in use and restored when the deck is.
- **900px** is the breakpoint, the same as the existing group layout's, so
  there's one width where the page changes shape.
- The empty slot now says **Pick a card from the deck**, as "below" is no
  longer where the deck is.

## Follow-up asks, same day, before commit

- **Save plan and Clear plan always visible.** They go in a sticky bar at the
  top of the plan column. A solid band over the galaxy looked heavy while
  nothing was under it, so its shade fades in over the first 24px of
  scrolling with a scroll-driven animation, and is simply always on where
  that isn't supported.
- **Animate the switch on narrow screens.** CSS transitions on `zoom` and
  `grid-template-columns`. The columns became `calc()` lengths, since `fr`
  to `px` doesn't interpolate. That meant dropping the remount on switch
  (above): a remounted element starts at its end value, so nothing would
  animate. It turned out not to be needed, because Motion measures during
  React's commit, before a transition has changed anything. The restored
  deck scroll now follows the page each frame while the deck grows, as the
  page isn't tall enough for it at the start.
- **Columns at least the window's height on narrow screens**, so a click on
  the empty space under a shrunk column switches too.
- **The slot once something's picked** is only a **select random** link,
  with no frame, background, "Pick a card from the deck" or "or". That
  replaces the shorter dashed box first planned.

- **Remember the last column used on a wide screen.** Presses (capture
  phase, so nothing inside can swallow them) and focus within a column set
  the same `active` state the narrow-screen switch uses. It has no effect on
  the wide layout, so narrowing the window just picks it up. The deck is the
  default. It doesn't save the deck's scroll, which only matters for a
  switch on a narrow screen.

- **Bugs found with a stress test (add, discard, resize, switch).** Two
  causes. First, cards leaving the deck could be left behind, invisible but
  clickable, and a pick could leave its card in the deck. That was on `main`
  too: the exit animated `scale`, and `leaveCard`'s spring back took `scale`
  over as the mouse left the vanishing card, so the exit never finished and
  AnimatePresence never removed it. Exits now only fade. Second, switching
  `layoutId` and `layout` on and off with the column in use (above) changed
  props Motion only reads when a card first appears. Shared `layoutId`s are
  gone altogether. Discarding flies a `FlyingCard` back into the deck, which
  also gives the fly-back on narrow screens that was missing. A shrunk
  column gets an instant transition instead of `layout={false}`. The deck's
  grid became `position: relative` for `popLayout` and for measuring the
  slot.

- **The buttons above both columns.** Save plan and Clear plan moved out of
  the plan column into a bar across both (`.builder-bar`), showing "Pick a
  card from the deck" until there's a plan. It still sticks, to the top of
  the page now, to keep the earlier ask that they stay in sight, and the plan
  column sticks under it at its measured height. The shade fades in with a
  `scroll-state(stuck)` container query. Scroll padding keeps things
  scrolled into view from landing under it. That turned up when Playwright's
  scroll-then-click put a card's buttons under the bar.
- **The slot is blank** and only there until something's picked, and the
  link is **Draw random card**, always under the first row. (First asked
  for as replacing the slot outright, then changed to keeping it blank.)
- **Text spilling out of a card flying into the shrunk plan.** The stand-in
  was laid out at the slot's drawn size, 50px wide, where the font sizes'
  minimums kept the text too big. It's now laid out at the card's own size
  and scaled by the slot's `currentCSSZoom`. The flight e2e test checks, on
  every frame, that the words stay inside the card; with the old sizing it
  failed on 32 frames.

- **The first card covers the slot.** Rather than the slot vanishing as the
  first card is picked, a copy of it is drawn absolutely at the top of the
  row, under the card's (hidden) place, for as long as that card's flight
  lasts, so the stand-in visibly lands on it.

- **No background on the bar**, just the text halo, by adding `.builder-bar`
  to the halo list (it inherits); the shade and its `scroll-state` query
  went.
- **Draw random card, groups and Add group slide** as cards come in: they're
  Motion elements with `layout="position"`, so a group growing doesn't
  scale-distort its inputs.

- **Sliding in the shrunk plan too.** An instant transition there looked
  like a jump. A `transformTemplate` divides Motion's projection translate
  by the zoom (0.2), so the slide starts from where the element really was.
  Only for the position-only elements; cards in a shrunk column still snap.
- **The bar's prompt and buttons crossfade**: both in one grid cell under
  `AnimatePresence`, with the outgoing one inert (`useIsPresent`).

- **The bar isn't sticky after all.** The measured `--bar-height` and the
  scroll padding went with it, and the plan column sticks at the top again.
- **On narrow screens the plan's rows use the deck's grid.** Applied to the
  whole narrow layout, not only while the plan is in use: shrunk, it's laid
  out about 320px wide, which is one column anyway, and the layout doesn't
  flip between flex and grid as a switch starts. The plan page's
  `grid-auto-flow: column` on `.plan-track` had to be reset. Dragging goes
  in reading order when the row's `grid-template-columns` has several
  tracks.

- **Grids shuffle when their column count changes** (`useGridShuffle`). A
  ResizeObserver per grid, places remembered after each render and resize,
  and a WAAPI `translate` animation from old place to new, which composes
  with Motion's `transform`. Sections became positioned so places are in
  their own (possibly zoomed) units. An early version died in dev: StrictMode's
  simulated unmount disconnected the observer without clearing it.
- **Clear plan flies every card home**: flights became a list, one per card.
- **No scrollbar flicker when a card leaves.** Motion's slide keeps items at
  their old places with a transform, which counts towards a scroll
  container's overflow, and the plan column was only as tall as the plan. It's
  now always the window's height.

- **Text re-wrapping when a second card is picked**, only with scrollbars
  that take room (hidden in headless Chromium, so the e2e test turns them
  on). The scrollbar narrowed the cards, which made them shorter, which
  could make the scrollbar unnecessary again. `scrollbar-gutter: stable` on
  the plan column.

- **Scrolling over the plan carries on to the page**: the column's
  `overscroll-behavior: contain` went.
- **Cards flying in from above on a switch.** Three causes, found by
  recording video of the switch. The shuffle ran part way through the zoom,
  over long distances; grids now hold their columns until the zoom is over.
  Letting go was a render, so Motion animated the change too; it's a timer.
  And the page, much shorter with the deck shrunk, scrolled up under the
  deck each frame; the part of the deck at the top of the window is now kept
  there (`deckAnchor`), which also replaces the old catch-up scroll back to
  the deck. Cards arriving from off screen fade in rather than slide.

- **Cards still flew down from the top when the plan was put in use.** The
  deck re-laid out from several columns to one as it shrank, and that can't
  be animated without cards travelling a long way. Taking the offer to shrink
  whole columns: the strip is a fifth as wide as the column in use
  (`calc((100% - gap) / 6)` against five sixths), so at zoom 0.2 it's laid
  out just as wide, with the same columns. The column widths and the zoom
  move on the same curve, so a column's width over its zoom is five sixths of
  the space all the way through, and nothing re-lays out during a switch.
  The plan column's scrollbar gutter, which isn't zoomed, is swapped for the
  same width of padding while shrunk or switching. The hold from the entry
  above now only matters when crossing 900px.

- **The slot under the first card covered the whole plan grid** while the
  card flew, when the shrunk plan had several columns: `grid-area: 1 / 1`
  on something absolutely positioned over a grid leaves its end lines at
  the grid's far edges. Now `1 / 1 / 2 / 2`.

- **One grid rule for the deck and the plan.** The narrow plan's copy of
  the deck's column formula went; `.card-grid, .plan-column .plan-track`
  share it, and a wide screen turns the plan's rows back into a column.
- **Short last lines centred.** A CSS grid can't, so the grid became
  wrapping flex lines, each card a column's width from `--columns`, now
  registered with `@property` as an integer so the shuffle and the drag can
  read it (they read `grid-template-columns` before) and the hold can pin
  it.
- **The Plan title, and fading ends.** The plan column became the sticky
  frame, holding the title and a scroller (`.plan-scroll`) under it, which
  is what scrolls, is masked, and is `planReference`. The fades are
  registered lengths, so they transition.

- **Fades missing after a reload with kept picks**, and the title off
  centre from the cards. Kept picks remount the plan and the builder under a
  new `LayoutGroup` key, so effects that set up on `[]` were left on
  replaced elements: the scroll marks and the measured scrollbar gutter now
  run again on `layoutGeneration`. The gutter is on both edges, so the cards
  stay centred under the title, and the shrunk plan pads both sides.

- **Cards slide in a shrunk column too.** `unshrinkSlide` on everything
  laid out in either shrunk column, cards included, in place of their
  instant transitions: only Motion's translate needs scaling, as its scale is
  a ratio. The first card in a shrunk two-column plan now slides over when a
  second comes in.

## Checklist

- [x] Rename `DeckBuilder` to `PlanBuilder`, with its test and every
      reference outside frozen plans.
- [x] Two-column layout, sticky scrolling plan column, vertical rows.
- [x] Vertical drag, column edge scrolling, `stepCard` for the keyboard.
- [x] Narrow screens: `zoom`, `ColumnSwitch`, `inert`, no layout animations
      while shrunk, deck scroll restored (remount on switch dropped, see
      follow-ups).
- [x] `FlyingCard` lands in a scrolled or shrunk column.
- [x] Unit tests: `stepCard`, the keyboard in the builder, the plan column,
      narrow screens (switching, inert, scroll restored).
- [x] Follow-ups: sticky actions, animated switch, full-height columns,
      select random, last column used, stress-test fixes, bar above both
      columns, blank slot and Draw random card, flight text sizing.
- [x] E2E: vertical drags, column edge scrolling, the column beside the
      deck and sticking, switching columns on a narrow screen.
- [x] Docs: `card-layout.md` (§ "The plan column", § "Narrow screens",
      § "Reordering the plan"), `plans.md` § "Groups", `AGENTS.md` table.
