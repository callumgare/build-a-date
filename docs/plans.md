# Plans

A plan is the cards someone picked from a shared deck (`/d/…`), in their order. Pressing **Done** saves it under its own link (`/p/…`), which is what gets shared. Pressing **Done** again without changing anything shares the same link rather than saving a new plan.

Owners and editors see every plan made from the deck listed on the deck's page and on the shared deck ([deck-sharing.md](deck-sharing.md) § "Who can do what").

A plan lists card ids, not copies (the `plan` table's `card_ids`). Editing a card changes it in every plan that has it, and a deleted card drops out.

## Picks are kept in the browser

The picks in progress are kept in the browser. They aren't in the URL, so a link to `/d/…` never carries anyone's picks. The helpers are in `src/components/keptPicks.ts`.

- **One set per deck.** Picks for a new plan are kept in local storage under `build-a-date:picks:deck:<shareId>`, so each deck remembers its own, the next time it's opened in any tab. Once **Done** has saved them as a plan they're forgotten, so **Create new plan** (or a reload) starts with nothing picked. Changing the plan again on the same page keeps it again, until the next **Done**.
- **One set per plan being edited, for a reload only.** Changes to a saved plan are kept under `build-a-date:picks:plan:<planId>` in session storage, apart from the deck's own picks. A reload of the edit page keeps them. They're forgotten when they're saved (**Update Plan**), on **Cancel**, when the plan page is shown again (by a link, the back button or a reload), and when the tab is closed. So **Edit plan** always starts from the saved plan, including changes other people have made to it.
- **Nothing kept for nothing.** When there's nothing unsaved (no picks, or the plan as it was last saved), the entry is removed. An emptied plan that's being edited is kept as empty.
- **Straight into the plan.** After a reload, the kept picks are in the plan from the first frame. They don't fly up from the deck.
- **Only this browser.** Picks don't follow someone to another browser or device. If storage is unavailable or full (a private window, blocked site data), the plan still works, it just isn't kept.

The server can't see local storage, so the page first renders with no picks (or the saved plan). `DeckBuilder` reads the kept picks in a layout effect, before the browser paints. If they change the plan, the plan and the deck remount under a new `LayoutGroup` id. Their shared-layout ids (`layoutId`) are then new, so Motion has no earlier position to animate the cards from.

## The plan page

`/p/[planId]` shows the plan's cards in order, with **Share**, **Edit plan** and **Create new plan** (which goes to the deck's builder).

- Each card has only **Notes** in its options band, not **Discard** (see [card-notes.md](card-notes.md) § "Card actions"). A click anywhere on the card opens its notes, the same flip-over view as on the shared deck.
- Ratings and notes are jotted in the corner of each card, as on the shared deck ([card-notes.md](card-notes.md) § "Rating and notes on the card").
- Owners and editors get the edit button in each card's bottom left corner ([card-notes.md](card-notes.md) § "Editing a card").

The cards are `PlanView` in `src/components/PlanView.tsx`. The options, tilt and edit button come from `src/components/cardControls.tsx`, which the builder uses too.

## Editing a plan

**Edit plan** goes to `/p/[planId]/edit`. It's the shared deck's builder with the plan's cards already in the plan, and **Editing a plan** under the deck's name. Cards can be added, discarded and reordered as usual.

- **Update Plan** (in place of **Done**) saves over the plan, so its link stays the same, then shares that link. If nothing has changed, it shares the link without saving.
- **Cancel** goes back to the plan page without saving, and drops the unsaved changes, so the next edit starts from the saved plan.
- Leaving without either, and coming back to the plan page, drops the changes too. A reload of the edit page keeps them (see [Picks are kept in the browser](#picks-are-kept-in-the-browser)). The plan page forgets them with `ForgetPlanEdits`, when it mounts and when the browser brings it back from its back-forward cache.
- The buttons stay showing even when every card has been taken out, so **Cancel** is still there. **Update Plan** can't be pressed then, as a plan needs at least one card.
- The same rules apply as for a new plan: only cards from the deck, in the order given, without repeats, and at least one card (`updatePlan` in `src/lib/decks.ts`).
- Saving replaces the plan. No history of earlier versions is kept.

## Who can edit a plan

Anyone with the plan's link, signed in or not. Plans are made without an account, so there's no owner to check against. The plan page already links to the deck, and anyone with the deck's link can already build plans and change the notes, so a plan link doesn't give anything new.
