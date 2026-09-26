# Groups in a plan

## Asked for

1. Cards in the plan can be grouped, and a group has a title and notes.
2. Groups show on a separate line from the plan's other cards. An **Add group** button makes a new, empty group, and cards can be dragged between groups.

## Decisions

- **Rows.** The plan's existing track stays as its first row, for cards not in a group. Each group is a row of its own under it: title, notes, then its cards. New picks from the deck go onto the first row. The plan page shows the groups the same way, read-only.
- **Title and notes beside the cards when there's room.** Asked for once the rows were built. From 900px wide, a group is a two-column grid: title, notes and **Remove group** on the left, its track on the right. The track still bleeds to the right edge of the screen, but not the left. Narrower, they stack above the cards, with **Remove group** beside the title.
- **Storage.** The `plan` table keeps `card_ids` (now the first row) and gets a `groups` JSON column of `{ id, title, notes, cardIds }`, default `[]`, so existing plans read as having no groups. There's no separate table: a plan is always read and written whole, like `card_ids`. `savePlan`/`updatePlan` take the groups as an optional third argument, so existing callers don't change.
- **Shared rules.** Moving, removing and de-duplicating cards across rows is in `src/lib/plan-picks.ts`, pure functions used by the builder, the kept picks and the server.
- **Rules on saving.** Each card once, in the first place it's given, and only cards from the deck. At least one card in the whole plan, not necessarily on the first row. Groups with no title, notes or cards are dropped. A group with notes but no cards is kept (for "get a taxi home"). Up to 20 groups, titles up to 80 characters, notes up to 2000.
- **Removing a group** puts its cards back on the end of the first row rather than discarding them, so nothing picked is lost by accident.
- **Kept picks** are stored as `{ cardIds, groups }`. A plain array, the format kept before, is read as the first row.
- **Dragging between rows.** Motion's `Reorder` only reorders within one list, and a `Reorder.Item` can't move to another group mid-drag. So the plan has its own drag (`usePlanDrag` in `src/components/PlanCard.tsx`). The card stays in the plan (faded) and moves through the picks to wherever it would land, while a stand-in above the page follows the pointer and settles into place when it's let go. It keeps the existing behaviour: a mouse drags from anywhere, a touch from the grip, a drag isn't a click, the lean, and the edge scrolling. It adds scrolling the page at the window's top and bottom. Places are measured from offsets, which layout animations don't change, so there's no flicker as cards slide.
- **Keyboard.** The grip's up and down arrow keys move a card to the row above or below, at the same index, or the end if that row is shorter.
- **No `AnimatePresence` on the plan's rows.** With it, a card moved to another row stays in the row it left, as an exiting element sharing its `layoutId`. Nothing in the plan had an exit animation, and a discarded card still flies to the deck by its `layoutId`.

## Steps

- [x] `PlanGroup`/`PlanPicks` types, the `groups` column and its migration (`drizzle-kit generate --name add_plan_groups`).
- [x] `src/lib/plan-picks.ts` and its tests.
- [x] Validation, `savePlan`/`updatePlan`/`getPlan`/`listPlanSummaries`, and the actions.
- [x] Kept picks in the new shape, reading the old one.
- [x] `PlanCard.tsx`: the cross-row drag, replacing `Reorder` and `useDragFollower`.
- [x] `DeckBuilder`: picks with groups, group rows, **Add group**, **Remove group**, title and notes fields.
- [x] `PlanView` and the plan page showing groups; the edit page passing them in.
- [x] Tests: queries, actions, both plan pages, `PlanView`, `DeckBuilder`, e2e for grouping by drag and by keyboard, with the existing reordering e2e tests still passing.
- [x] Docs: `plans.md` § "Groups", `card-layout.md` § "Reordering the plan", `AGENTS.md`.
