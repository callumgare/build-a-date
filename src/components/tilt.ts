// How far a hovered card leans either way, in degrees
// (docs/card-layout.md § "Tilting on hover").
export const minRotate = 0.2
export const maxRotate = 1
// And how much bigger it grows as it lifts.
export const hoverScale = 1.04

// Picks a new lean for every hover, so a card tips a different way each time.
export function randomTilt(random = Math.random): number {
  const side = random() < 0.5 ? -1 : 1
  return Math.round(side * (minRotate + random() * (maxRotate - minRotate)) * 100) / 100
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
