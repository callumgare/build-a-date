# Plans

A plan is the cards someone picked from a shared deck (`/d/…`), in their order, and any groups they put them in (see [Groups](#groups)). Pressing **Save plan** saves it under its own link (`/p/…`), which is what gets shared (see [Sharing a plan](#sharing-a-plan)).

Owners and editors see every plan made from the deck listed on the deck's page and on the shared deck ([deck-sharing.md](deck-sharing.md) § "Who can do what").

A plan lists card ids, not copies: the `plan` table's `card_ids` for its first row, and each group's `cardIds` in its `groups`. Editing a card changes it in every plan that has it, and a deleted card drops out, from its group too.

## Groups

Cards in a plan can be put in groups, each with a title and notes, such as "Dinner" with "Book for 7pm", or two ideas to choose between on the day.

- **Rows of their own.** The plan's first row holds the cards not in a group. Each group is a row of its own under it. Cards picked from the deck go onto the end of the first row.
- **Title and notes beside the cards.** On a screen at least 900px wide, a group's title, notes and **Remove group** sit in a column to the left of its cards, which start next to them rather than centred. On a narrower screen they're above the cards, with **Remove group** beside the title. The plan page lays groups out the same way.
- **Add group** under the last row adds an empty group at the bottom and puts the cursor in its title. Until it has a title it's called **Group 1**, **Group 2** and so on, by its place.
- **Moving cards between them.** A card is dragged from one row to another the same way it's dragged along a row, or moved with the arrow keys on its grip ([card-layout.md](card-layout.md) § "Reordering the plan"). An empty group says **Drag ideas here**.
- **Remove group** takes the group out of the plan. Its cards aren't discarded; they go back onto the end of the first row. Its title and notes are gone.
- **Discard** on a card in a group puts it back in the deck, as it does anywhere in the plan. **Clear plan** empties the groups too.
- **What's saved.** Titles are up to 80 characters and notes up to 2000, trimmed. A plan can have up to 20 groups, and needs at least one card somewhere, in its first row or a group. A group with no title, no notes and no cards isn't saved. A group with a title or notes but no cards is, so a plan can say "Get a taxi home" without an idea for it. The first row can be empty when every card is in a group.
- **On the plan page** each group shows its title as a heading and its notes as written (line breaks kept), beside or above its cards as in the builder. A group without a title has no heading. The title and notes are changed from **Edit plan**, not on the plan page.

The rules (`placeCard`, `moveCardBy`, `keepCards` and so on) are in `src/lib/plan-picks.ts`, used by the builder, the kept picks and `savePlan`/`updatePlan`, so they can't disagree.

## Picks are kept in the browser

The picks in progress are kept in the browser. They aren't in the URL, so a link to `/d/…` never carries anyone's picks. The helpers are in `src/components/keptPicks.ts`.

- **One set per deck.** Picks for a new plan are kept in local storage under `build-a-date:picks:deck:<shareId>`, so each deck remembers its own, the next time it's opened in any tab. Once **Save plan** has saved them as a plan they're forgotten, so **Create new plan** (or a reload) starts with nothing picked. Changing the plan again on the same page keeps it again, until the next **Save plan**.
- **One set per plan being edited, for a reload only.** Changes to a saved plan are kept under `build-a-date:picks:plan:<planId>` in session storage, apart from the deck's own picks. A reload of the edit page keeps them. They're forgotten when they're saved (**Update Plan**), on **Cancel**, when the plan page is shown again (by a link, the back button or a reload), and when the tab is closed. So **Edit plan** always starts from the saved plan, including changes other people have made to it.
- **Groups too.** What's kept is the first row and the groups, with their titles and notes (`{ cardIds, groups }`). Picks kept before there were groups, a plain list of ids, are read as the first row.
- **Nothing kept for nothing.** When there's nothing unsaved (no picks and no groups, or the plan as it was last saved), the entry is removed. An emptied plan that's being edited is kept as empty.
- **Straight into the plan.** After a reload, the kept picks are in the plan from the first frame. They don't fly up from the deck.
- **Only this browser.** Picks don't follow someone to another browser or device. If storage is unavailable or full (a private window, blocked site data), the plan still works, it just isn't kept.

The server can't see local storage, so the page first renders with no picks (or the saved plan). `DeckBuilder` reads the kept picks in a layout effect, before the browser paints. If they change the plan, the plan and the deck remount under a new `LayoutGroup` id. Their shared-layout ids (`layoutId`) are then new, so Motion has no earlier position to animate the cards from.

## The plan page

`/p/[planId]` shows the plan's cards in order, then its groups (see [Groups](#groups)), with **Share**, **Edit plan** and **Create new plan** (which goes to the deck's builder).

- Each card has only **Notes** in its options band, not **Discard** (see [card-notes.md](card-notes.md) § "Card actions"). A click anywhere on the card opens its notes, the same flip-over view as on the shared deck.
- Ratings and notes are jotted in the corner of each card, as on the shared deck ([card-notes.md](card-notes.md) § "Rating and notes on the card").
- Owners and editors get the edit button in each card's bottom left corner ([card-notes.md](card-notes.md) § "Editing a card").

The cards are `PlanView` in `src/components/PlanView.tsx`. The options, tilt and edit button come from `src/components/cardControls.tsx`, which the builder uses too.

## Editing a plan

**Edit plan** goes to `/p/[planId]/edit`. It's the shared deck's builder with the plan's cards already in the plan, and **Editing a plan** under the deck's name. Cards can be added, discarded and reordered as usual.

- **Update Plan** (in place of **Save plan**) saves over the plan, so its link stays the same, then goes to the plan ready to share, like **Save plan** (see [Sharing a plan](#sharing-a-plan)). If nothing has changed, it goes there without saving.
- **Cancel** goes back to the plan page without saving, and drops the unsaved changes, so the next edit starts from the saved plan.
- Leaving without either, and coming back to the plan page, drops the changes too. A reload of the edit page keeps them (see [Picks are kept in the browser](#picks-are-kept-in-the-browser)). The plan page forgets them with `ForgetPlanEdits`, when it mounts and when the browser brings it back from its back-forward cache.
- **Delete plan** takes the place of **Clear plan** (see [Deleting a plan](#deleting-a-plan)).
- The buttons stay showing even when every card has been taken out, so **Cancel** is still there. **Update Plan** can't be pressed then, as a plan needs at least one card.
- The same rules apply as for a new plan: only cards from the deck, in the order given, without repeats, and at least one card (`updatePlan` in `src/lib/decks.ts`). Its groups are saved over too (see [Groups](#groups)).
- Saving replaces the plan. No history of earlier versions is kept.

## Sharing a plan

Once **Save plan** or **Update Plan** has saved the plan, the browser goes to the plan's page with its share dialog already open. The builder has no share dialog of its own. The dialog is the same one the plan page's **Share** button opens:

- **Copy link** copies the plan's link.
- **Share…** opens the device's share sheet, on devices that have one. Browsers only open the sheet straight after a press, so it can't open by itself when the page loads.
- **Close** closes it.

There's no link to open the plan, since that's the page it's on. While saving, the button says **Saving…** and can't be pressed again. If saving fails, the builder stays put and shows why.

The builder goes to `/p/<planId>?share`, and the plan page opens the dialog when it sees `share` (`openOnLoad` on `SharePlanButton`). The dialog then takes `?share` off the address, so a reload doesn't open it again. The link it shares never includes it either.

## Deleting a plan

**Delete plan** on the edit page deletes the plan, after the browser asks to confirm. Its link stops working (it shows the not-found page), and it drops out of the deck's list of plans. The browser then goes to the deck (`/d/…`), with nothing picked, and any unsaved changes to the plan are forgotten. If deleting fails, the edit page stays and shows why.

Anyone who can edit a plan can delete it (`deletePlan` in `src/lib/decks.ts`). The deck and its other plans aren't touched.

## Who can edit a plan

Anyone with the plan's link, signed in or not. The same goes for deleting it. Plans are made without an account, so there's no owner to check against. The plan page already links to the deck, and anyone with the deck's link can already build plans and change the notes, so a plan link doesn't give anything new.
