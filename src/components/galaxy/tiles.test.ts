import { TILE_HEIGHT, tilePlan } from './tiles'

/** @see docs/background.md § "Tiles" */
describe('tilePlan', () => {
  it('paints the tiles the window shows now', () => {
    expect(tilePlan(0, 700, 900, 10_000).visible).toEqual([0, 1, 2])
    expect(tilePlan(TILE_HEIGHT * 10 + 5, 300, 900, 10_000).visible).toEqual([10, 11])
  })

  it('paints ahead, above and below the window, nearest first', () => {
    const plan = tilePlan(TILE_HEIGHT * 10, TILE_HEIGHT, TILE_HEIGHT * 2, 10_000)
    expect(plan.visible).toEqual([10])
    expect(plan.ahead.slice(0, 2).sort()).toEqual([11, 9].sort())
    expect(plan.ahead.slice(2).sort()).toEqual([12, 8].sort())
    expect(plan.ahead).not.toContain(10)
  })

  it('lets go of tiles several windows away', () => {
    const plan = tilePlan(TILE_HEIGHT * 40, TILE_HEIGHT, TILE_HEIGHT, 100_000)
    expect(plan.keepFrom).toBe(37)
    expect(plan.keepTo).toBe(43)
  })

  it('never goes above the top of the page or past its end', () => {
    const plan = tilePlan(0, 700, 5000, 1000)
    expect(Math.min(...plan.visible, ...plan.ahead)).toBe(0)
    expect(Math.max(...plan.visible, ...plan.ahead)).toBe(3)
    expect(plan.keepFrom).toBe(0)
    expect(plan.keepTo).toBe(3)
  })

  it('still has a tile for a page shorter than one', () => {
    expect(tilePlan(0, 100, 100, 50).visible).toEqual([0])
  })
})
