# Plan editing, notes on the plan page, and picks in local storage

## Asked for

1. It should be possible to edit a plan once it's been made.
2. The plan page (`/p/…`) shows the rating and notes scrawls, like the builder does, and the options band at the top of each card, with only **Notes** (no Discard). People who can edit the deck get the pencil button in the bottom left corner, as on the builder.
3. The builder stops keeping picks in the URL fragment and keeps them in local storage instead. After a reload the picks appear straight away in the plan, rather than animating up from the deck.

## Decisions

- **Where editing happens.** `/p/[planId]/edit` renders `DeckBuilder` with the plan's cards already in the plan. **Done** saves over the same plan, so its link doesn't change. The plan page links to it with **Edit plan**.
- **Who can edit a plan.** Anyone with the plan's link. Plans are made by anyone with the deck's link, without an account, and the plan page already links to the deck, so a plan link already gives everything a deck link does. There's no owner to check against.
- **What's kept in local storage.** One entry per deck (`build-a-date:picks:deck:<shareId>`) for a new plan, and one per plan being edited (`build-a-date:picks:plan:<planId>`), so editing a plan doesn't disturb picks for a new one. An entry is removed when it matches what the page would start with anyway (no picks for a new plan; the saved cards for an edit), so a plan being edited follows later changes made elsewhere once it's been saved.
- **Restoring without the fly-up.** The server can't see local storage, so the first render has the server's picks. Picks are read in a layout effect, before the browser paints. If they change anything, the plan and deck remount under a fresh `LayoutGroup` id: new elements with new shared-layout ids, so Motion has nothing to animate from.
- **The plan page's cards** are a client component (`PlanView`). The options, tilt, reveal-on-tap and edit button move out of `DeckBuilder` into `src/components/cardControls.tsx` so both use the same code. With only Notes, a click anywhere on the card opens its notes.

## Steps

- [x] `updatePlan` in `src/lib/decks.ts` and `src/lib/actions/plans.ts`, sharing the "only cards from this deck, in order, no repeats" rule with `savePlan`.
- [x] `/p/[planId]/edit` page.
- [x] `DeckBuilder`: `plan` prop, local storage in place of the hash, restore without animation.
- [x] `cardControls.tsx`, `PlanView`, the plan page using it with the access check.
- [x] Revalidate plan pages when cards change.
- [x] Tests: queries, action, both pages, `DeckBuilder`, `PlanView`, e2e for editing a plan and for the reload.
- [x] Docs: new `docs/plans.md`; update `card-notes.md`, `card-layout.md`, `AGENTS.md`, README.
