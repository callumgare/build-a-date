# Plan: card ratings and notes (2026-09-24)

## Request

On a shared deck (`/d/xxxx`), clicking a card should no longer add it to the plan straight away. Hovering it should offer **Add to plan** or **Notes**. Notes flips the card over and grows it to fill most of the viewport, with a maximum size for desktop. The back has five empty stars at the top to rate interest, then free-text notes. Cards in the plan get the same treatment, with **Discard** in place of Add to plan.

## Approach

- [x] **Schema**: `interest` (nullable integer) and `notes` (text, default `''`) columns on `card`. The migration was generated with `drizzle-kit generate --name add_card_notes`.
- [x] **Query and action**: `saveCardNotes(db, shareId, cardId, { interest, notes })` in `src/lib/decks.ts`, plus a public server action in `src/lib/actions/plans.ts`, validated by `cardNotesInput`.
- [x] **Card actions**: the buttons show in the band at the top of the card, on hover, on a tap for touch screens, or on keyboard focus. Plan cards have Discard and Notes.
- [x] **Notes view** (`src/components/CardNotes.tsx`): a modal `<dialog>` in which the card flips from its place, laid out 3:4 and at most 540px wide. The stars are radio buttons, and clicking the chosen one again clears it. Changes autosave, one save at a time.
- [x] **Tests**: unit tests for the query, the validation and the component, and an e2e test of a guest rating a card and leaving notes that the owner then sees.
- [x] **Docs**: `docs/card-notes.md`, and the permissions table in `docs/deck-sharing.md`.

## Decisions

- **Stored on the card, not per person or per plan.** The user asked for the notes to be saved with the deck. There's one rating and one set of notes per card, and anyone with the share link can change them. Whoever saves last wins.
- **The buttons show in the top band of the card, with no backdrop.** They were first an overlay with a scrim across the card, then tabs sliding out from behind its bottom edge. The user settled on the buttons sitting at a fixed distance from the top, over a shade that fades out below them. They sit inside the shortest frame's top inset, so they never cover the text or its links.
- **Buttons have an `aria-label`** (e.g. "Add to plan: Picnic") that starts with the visible text. A visually hidden span was tried first, but Chrome puts a space around it ("Add to plan : Picnic").
- **The rating saves straight away. Notes save after 0.7 seconds, and on blur, close and page hide.**
