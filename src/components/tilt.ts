// How far a hovered card leans either way, in degrees
// (docs/card-layout.md § "Tilting on hover").
export const minRotate = 0.2
export const maxRotate = 1
// And how much bigger it grows as it lifts.
export const hoverScale = 1.04

type Point = { x: number; y: number }
type Rect = { left: number; top: number; width: number; height: number }

// The lean a card takes as the mouse comes onto it: tipped away from where it
// came in, as if the pointer had nudged it there. Worked out like a push on
// the card's edge, turning it about its centre, so coming in near a corner
// tips it the most and coming straight at the middle of an edge barely at
// all. `movement` is which way the mouse was going; without it the push is
// taken as straight in from the nearest edge. Positive is clockwise.
export function entryLean(point: Point, rect: Rect, movement?: Point): number {
  const halfWidth = rect.width / 2
  const halfHeight = rect.height / 2
  if (!halfWidth || !halfHeight) return 0
  // Where on the card, from -1 to 1 across and down from its centre.
  const across = clamp((point.x - rect.left - halfWidth) / halfWidth, -1, 1)
  const down = clamp((point.y - rect.top - halfHeight) / halfHeight, -1, 1)

  let push = movement && (movement.x || movement.y) ? movement : null
  if (!push) push = Math.abs(across) >= Math.abs(down) ? { x: -Math.sign(across), y: 0 } : { x: 0, y: -Math.sign(down) }
  const length = Math.hypot(push.x, push.y)
  if (!length) return 0

  const turn = clamp((across * push.y - down * push.x) / length, -1, 1)
  if (Math.abs(turn) < 0.01) return 0
  return round(Math.sign(turn) * (minRotate + Math.abs(turn) * (maxRotate - minRotate)))
}

// How far a card leans while it's dragged, at most, and how fast it has to go
// to lean that far, in pixels a second (docs/card-layout.md § "Reordering
// the plan").
export const maxDragRotate = 5
export const fullLeanSpeed = 1500

// A dragged card leans back from the way it's going, like a card held by its
// bottom edge, and straightens up as it slows down.
export function dragLean(velocity: number): number {
  return round(-clamp(velocity / fullLeanSpeed, -1, 1) * maxDragRotate) || 0
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function round(value: number) {
  return Math.round(value * 100) / 100
}

// Reads how far an element is turned, in degrees, from its computed
// transform, which the browser gives as a matrix.
export function leanOf(transform: string) {
  const match = /^matrix\(\s*([^,]+),\s*([^,]+)/.exec(transform)
  if (!match) return 0
  return (Math.atan2(Number(match[2]), Number(match[1])) * 180) / Math.PI
}

// `rotate` is how far the card leans there, so an animation can start from it.
export type Box = { left: number; top: number; width: number; height: number; rotate?: number }

// Where a card leaning `rotate` would be if it sat straight: the same centre,
// but the size of the card itself rather than of the larger box its corners
// lean out to. Works from the bounding box, rather than offsetWidth, so a
// card caught mid layout-animation still gives the size it's drawn at.
export function untiltedBox(element: Element, rotate: number): Box {
  const bounds = element.getBoundingClientRect()
  const { offsetWidth, offsetHeight } = element as HTMLElement
  const ratio = offsetWidth > 0 ? offsetHeight / offsetWidth : 4 / 3
  const radians = (Math.abs(rotate) * Math.PI) / 180
  const width = bounds.width / (Math.cos(radians) + ratio * Math.sin(radians))
  const height = width * ratio

  return {
    left: bounds.left + (bounds.width - width) / 2,
    top: bounds.top + (bounds.height - height) / 2,
    width,
    height,
    rotate,
  }
}
