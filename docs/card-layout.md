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

## Reordering the plan

The cards in the plan can be put in a different order. The plan starts in the order the cards were picked (see [deck-sorting.md](deck-sorting.md) § "How it fits with filters and the plan"), and the new order is the one that's shared when **Done** is pressed.

- **By dragging it.** With a mouse, a card in the plan can be dragged from anywhere on it, and the other cards slide out of its way. A press that doesn't move is still a click, so the options on each side work as before.
- **The grip.** A card in the plan has a grip, six white dots in a half circle of shade rising from the middle of its bottom edge. The shade is the same colour as the one behind the options at the top of the card, but it spreads a little further and fades out slowly, well past the grip. Only the grip itself takes clicks, not the shade around it. It shows whenever the card's options do (see [card-notes.md](card-notes.md) § "When the options show"). Cards in the deck don't have one.
- **Only the grip, on a touch screen.** A touch only drags the card from its grip, so a swipe across the rest of the card still scrolls the plan. The grip shows after a tap, like the options, and can then be dragged.
- **Not a click.** Pressing the grip, or letting go of a drag over the card, doesn't discard the card or open its notes. A drag doesn't start from a link in the description, which is followed as usual.
- **Scrolls with the drag.** Dragging a card up to either end of the plan scrolls it, so a card can be moved past cards that are out of sight.
- **From the keyboard.** The grip is a button (**Move …**). Left and right arrow keys move the card one place along the plan, and the grip keeps focus so it can be moved again.
- **In the link.** The picks in the URL follow the new order straight away, so a reload keeps it.

The drag is Motion's `Reorder`: the plan track is a `Reorder.Group` and each card in it is a `Reorder.Item` (`PlanCard` in `src/components/DeckBuilder.tsx`) that starts its drag itself, through `useDragControls`, so it can leave touches off the grip alone.
