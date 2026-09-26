/** How tall each tile of the background is, in CSS pixels. */
export const TILE_HEIGHT = 256

/** How many times the reach away a tile can be before it's removed. */
const KEEP_REACHES = 3

export type TilePlan = {
  /** The tiles the window shows now, to paint straight away. */
  visible: number[]
  /** The tiles to paint ahead of time, nearest the window first. */
  ahead: number[]
  /** Tiles outside `keepFrom`–`keepTo` (inclusive) are removed. */
  keepFrom: number
  keepTo: number
}

/**
 * Which tiles of the background to paint and which to let go, for a window
 * showing `scrollTop` to `scrollTop + viewportHeight` of a page `pageHeight`
 * tall, all in CSS pixels. Tiles within `reach` of the window are painted
 * ahead of time, and tiles several reaches away are removed
 * (docs/background.md § "Tiles").
 */
export function tilePlan(scrollTop: number, viewportHeight: number, reach: number, pageHeight: number): TilePlan {
  const last = Math.max(0, Math.ceil(pageHeight / TILE_HEIGHT) - 1)
  const index = (y: number) => Math.min(last, Math.max(0, Math.floor(y / TILE_HEIGHT)))
  const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i)

  const top = scrollTop
  const bottom = scrollTop + Math.max(viewportHeight, 1) - 1
  const visible = range(index(top), index(bottom))

  const distance = (tile: number) => {
    const tileTop = tile * TILE_HEIGHT
    return Math.max(top - (tileTop + TILE_HEIGHT - 1), tileTop - bottom, 0)
  }
  const ahead = range(index(top - reach), index(bottom + reach))
    .filter((tile) => !visible.includes(tile))
    .sort((a, b) => distance(a) - distance(b))

  return {
    visible,
    ahead,
    keepFrom: index(top - KEEP_REACHES * reach),
    keepTo: index(bottom + KEEP_REACHES * reach),
  }
}
