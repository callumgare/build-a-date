// Scrolling the plan while a card is dragged up to either end of it
// (docs/card-layout.md § "Reordering the plan" - scrolls with the drag).

// How far inside the track's edge a dragged card starts it scrolling, how
// much further in it has to go to scroll at full speed, and that speed, in
// pixels a second.
export const edgeZone = 32
export const edgeRamp = 96
export const maxScrollSpeed = 900

type Span = { left: number; right: number }

// How fast to scroll the track, in pixels a second, negative for towards its
// start. Only the edge the card has been dragged towards counts (`towards` is
// the way the pointer has gone since the drag started), so picking up a card
// that's already half out of sight doesn't set the track off.
export function edgeScrollSpeed(card: Span, track: Span, towards: number): number {
  const depth =
    towards > 0 ? card.right - (track.right - edgeZone) : towards < 0 ? track.left + edgeZone - card.left : 0
  if (depth <= 0) return 0
  return Math.sign(towards) * maxScrollSpeed * Math.min(1, depth / edgeRamp)
}
