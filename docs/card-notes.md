# Card notes

On a shared deck (`/d/…`), each idea can be given a star rating for how keen someone is on it, plus some free-text notes. These are saved on the card in the deck, not in a plan, so they're still there the next time anyone opens the link.

## Card actions

Clicking a card no longer does anything by itself. Instead, each card shows two buttons at its top:

| Where the card is | Buttons |
| --- | --- |
| In the deck | **Add to plan** adds it to the plan, which clicking it used to do. **Notes** opens its notes. |
| In the plan | **Discard** takes it out of the plan and back into the deck, which clicking it used to do. **Notes** opens its notes. |

**Notes** is covered in [Opening a card's notes](#opening-a-cards-notes).

When the buttons show depends on the device:

- With a mouse, they show on hover.
- On a touch screen, which has no hover, they show after a tap on the card. Tapping anywhere else hides them again. Hidden buttons don't take taps, so the first tap on a card can't add or discard it by accident.
- With a keyboard, Tab goes to each button in turn, and a card shows its buttons while one of them has focus.

The buttons sit the same distance from the top of every card, over a shade that fades out just below them. A card's text always starts below the band of frame art at its top (the frame's top inset), and even the shortest band is taller than the buttons, so they never cover the title or description. The shade doesn't take clicks, so links in the description keep working while the buttons are showing.

## Opening a card's notes

Pressing **Notes** lifts the card out of the deck or the plan. It flips over and grows until it fills most of the screen. It keeps the card's 3:4 shape and is never wider than 540px, so it doesn't get too big on a desktop. The back of the card has:

1. The idea's title, with the date the card was added under it (**Added 24 September 2026**, written the way the visitor's browser writes dates). It's the `created_at` column on the `card` table, so editing the card doesn't change it.
2. Five stars under **How keen are you?** They start empty. Clicking a star sets the rating to that many stars, and clicking the chosen star again clears it.
3. A box for free-text notes, empty apart from a placeholder until someone writes in it.

**Done**, Escape or a click beside the card flips it back into its place. With reduced motion turned on, it opens and closes without the flip.

## Rating and notes

Each card has one rating (1–5 stars, or none) and one set of notes, up to 2000 characters. They're the `interest` and `notes` columns on the `card` table. They belong to the idea, so editing its title, description, tags or date keeps them. Deleting the card deletes them.

The notes aren't shown on plans (`/p/…`), or on the deck's edit page.

## Who can change them

Anyone with the deck's share link can rate cards and write notes, including people who aren't signed in. This is the same as building a plan. There's only one rating and one set of notes per card, so whoever saves last wins.

`saveCardNotes` in `src/lib/decks.ts` finds the card through the share id. A card from another deck looks the same as one that doesn't exist.

## Saving

Changes save as they're made, with no save button:

- A rating saves as soon as a star is clicked.
- Notes save 0.7 seconds after the typing stops. They also save when the box loses focus, when the notes are closed and when the page is left.

Saves go one at a time, in order, so a slow save can't overwrite a newer one. The back of the card shows **Saving…**, then **Saved**. If a save fails, it shows why.
