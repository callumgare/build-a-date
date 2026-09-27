// Where the cards go in a link preview (docs/share-previews.md). Pure
// numbers, in pixels of the 1200×630 image, so they can be tested without
// drawing anything.

export const IMAGE = { width: 1200, height: 630 }

/** Where the cards start, below the deck's name. */
const CARDS_TOP = 176

/** A card in the preview: its top-left corner, size, and a turn in degrees about its centre. */
export type Placed = { x: number; y: number; width: number; height: number; rotate: number }

export const GRID = { columns: 5, width: 200, height: 267, gap: 24 }

/**
 * A deck's cards in rows under its name, as on the deck page. The second row
 * runs off the bottom of the image, so a big deck looks like it carries on.
 * Rows that would start below the image aren't drawn at all, and a single
 * short row is centred.
 */
export function deckGrid(count: number): Placed[] {
  const { columns, width, height, gap } = GRID
  const rows = Math.floor((IMAGE.height - CARDS_TOP) / (height + gap)) + 1
  const shown = Math.min(count, rows * columns)
  const inRow = Math.min(shown, columns)
  const left = (IMAGE.width - (inRow * width + (inRow - 1) * gap)) / 2
  return Array.from({ length: shown }, (_, index) => ({
    x: left + (index % columns) * (width + gap),
    y: CARDS_TOP + Math.floor(index / columns) * (height + gap),
    width,
    height,
    rotate: 0,
  }))
}

export const FAN = { width: 240, height: 320, maxCards: 9, maxStep: 16, spread: 72, radius: 900, centreY: 410 }

/**
 * A plan's picks fanned out like a hand of cards: on an arc about a point far
 * below the image, the first pick on the left and at the back, each turned a
 * little further than the last. The outer cards dip off the bottom.
 */
export function planFan(count: number): Placed[] {
  const { width, height, maxCards, maxStep, spread, radius, centreY } = FAN
  const shown = Math.min(count, maxCards)
  const step = shown > 1 ? Math.min(maxStep, spread / (shown - 1)) : 0
  const pivot = { x: IMAGE.width / 2, y: centreY + radius }
  return Array.from({ length: shown }, (_, index) => {
    const angle = (index - (shown - 1) / 2) * step
    const radians = (angle * Math.PI) / 180
    const centre = { x: pivot.x + radius * Math.sin(radians), y: pivot.y - radius * Math.cos(radians) }
    return {
      x: round(centre.x - width / 2),
      y: round(centre.y - height / 2),
      width,
      height,
      rotate: round(angle),
    }
  })
}

function round(value: number) {
  return Math.round(value * 100) / 100
}
