# Card notes

On a shared deck (`/d/…`), each idea can be given a star rating for how keen someone is on it, plus some free-text notes. These are saved on the card in the deck, not in a plan, so they're still there the next time anyone opens the link.

## Card actions

Each card shows two options in white text over a dark shade at its top. A white line runs down between them and fades out with the shade:

| Where the card is | Left | Right |
| --- | --- | --- |
| In the deck | **Add to plan** adds it to the plan. | **Notes** opens its notes. |
| In the plan | **Discard** takes it out of the plan and back into the deck. | **Notes** opens its notes. |

**Notes** is covered in [Opening a card's notes](#opening-a-cards-notes).

### Clicking a side of the card

A click anywhere on a card's left half does the left option, and anywhere on its right half does the right one. A click on a link in the description follows the link instead.

With a mouse, the option on the side the mouse is over is in bold. Over a link, neither is.

### When the options show

When the options show depends on the device:

- With a mouse, they show on hover.
- On a touch screen, which has no hover, they show after a tap on the card. Once they're showing, a tap on either side does that option. Tapping anywhere else hides them again. So the first tap on a card can't add or discard it by accident.
- With a keyboard, the two options are buttons. Tab goes to each one in turn, and a card shows its options while one of them has focus. The focused one is in bold.

The options sit the same distance from the top of every card. A card's text always starts below the band of frame art at its top (the frame's top inset), and even the shortest band is taller than the options, so they never cover the title or description. The shade doesn't take clicks, so links in the description keep working while the options are showing.

## Editing a card

Owners and editors (see [deck-sharing.md](deck-sharing.md) § "Who can do what") can change the deck's ideas without leaving `/d/…`:

- A small round pencil button sits in the bottom left corner of every card, in the deck and in the plan. It shows whenever the card's options do (see [When the options show](#when-the-options-show)). A click on it doesn't add, discard or open the notes. It opens the same **Edit idea** form as the deck's edit page, with **Save**, **Delete** and **Cancel**.
- **Add an idea** and **Quick Add** take the last spot in the deck, after the cards. They're the same as the first spot in the grid on the edit page (see [quick-add.md](quick-add.md) § "Adding an idea").

Nobody else sees either. The page only gets the deck's own id (`deckId` on `DeckBuilder`) for people who can edit it.

Saving or deleting a card refreshes the page with the deck's new cards. The deck doesn't shuffle again: the cards stay where they were, with their new text, and a new card goes first. `keepArrangement` in `src/lib/deck-order.ts` does this. A card in the plan that's deleted drops out of the plan. Ratings and notes changed on this visit stay as they were.

## Opening a card's notes

Pressing **Notes** lifts the card out of the deck or the plan. It flips over and grows until it fills most of the screen. It keeps the card's 3:4 shape and is never wider than 540px, so it doesn't get too big on a desktop. The back of the card has:

1. The idea's title, with the date the card was added under it (**Added 24 September 2026**, written the way the visitor's browser writes dates). It's the `created_at` column on the `card` table, so editing the card doesn't change it.
2. Five stars under **How keen are you?** They start empty. Clicking a star sets the rating to that many stars, and clicking the chosen star again clears it.
3. A box for free-text notes, empty apart from a placeholder until someone writes in it.

**Done**, Escape or a click beside the card flips it back into its place. With reduced motion turned on, it opens and closes without the flip.

## Rating and notes

Each card has one rating (1–5 stars, or none) and one set of notes, up to 2000 characters. They're the `interest` and `notes` columns on the `card` table. They belong to the idea, so editing its title, description, tags or date keeps them. Deleting the card deletes them.

The notes aren't shown on plans (`/p/…`), or on the deck's edit page.

### Rating and notes on the card

On `/d/…`, a card that's been rated or has notes has them jotted in its bottom right corner, drawn to look like pencil on the card (`Scrawl` in `src/components/Card.tsx`):

- A rating is a hand-drawn star outline with the number of stars written close beside it, so the star reads as a label for the number.
- Notes are three wavy lines of squiggle, one above the other, with the middle one shorter, after the rating if there is one, with a wider gap than between the star and the number. Only the fact that there are notes shows, not the notes themselves. Notes that are only spaces don't count.

A card with neither has nothing in its corner. The marks follow changes made on this visit straight away, including while the card is flipping over and back. Screen readers hear them as "Rated 3 out of 5. Has notes." The bottom left corner stays free for the edit button (see [Editing a card](#editing-a-card)).

## Who can change them

Anyone with the deck's share link can rate cards and write notes, including people who aren't signed in. This is the same as building a plan. There's only one rating and one set of notes per card, so whoever saves last wins.

`saveCardNotes` in `src/lib/decks.ts` finds the card through the share id. A card from another deck looks the same as one that doesn't exist.

## Saving

Changes save as they're made, with no save button:

- A rating saves as soon as a star is clicked.
- Notes save 0.7 seconds after the typing stops. They also save when the box loses focus, when the notes are closed and when the page is left.

Saves go one at a time, in order, so a slow save can't overwrite a newer one. The back of the card shows **Saving…**, then **Saved**. If a save fails, it shows why.
