# Card layout

How the cards are arranged on a shared deck (`/d/…`), both in the deck and in the plan track above it.

## Tilting on hover

Cards sit straight in their rows. While the mouse is over a card, it grows a little and tips to one side with a small spring, and it springs back when the mouse leaves. Picking a card up off the table feels loose, while the deck stays tidy.

- **Small.** A hovered card leans between 0.8° and 2° (`minRotate`/`maxRotate` in `src/components/tilt.ts`) and grows to 1.04× its size (`hoverScale`).
- **Different every time.** Each hover picks a new random lean (`randomTilt`), either way, so a card tips differently every time the mouse comes back to it.
- **Mouse only.** Touch screens don't tilt, so a tap never leaves a card leaning. The tilt runs from the cards' pointer enter and leave events, and skips touch pointers. It doesn't use Motion's `onHoverStart`, which runs a frame after the event, when the event no longer says which card it was on.
- **Settled by the animations.** A card is usually still leaning and grown when it's clicked. The card flying up into the plan straightens and shrinks back on the way. Opening a card's notes straightens it as it lifts and flips ([docs/card-notes.md](card-notes.md) § "Opening a card's notes").

The lean is a Motion `rotate` value, so layout animations measure cards as if they were straight. Animations that start from a card's place on screen use `untiltedBox`, which works out where the card would be if it were straight. They start from the lean the card has at that moment, read with `leanOf` from its computed transform. That lean is 0 when the card was opened from the keyboard, and part-way when the card was still springing back. `untiltedBox` also measures the card at the size it's drawn, so the animations start from a grown card's real size.

The plan track has extra padding so a hovered card's edges and corners aren't clipped by its horizontal scrolling.
