import { SITE_SLACK } from './shader'
import { decodeSites, pickSite, SHOOTING_STAR_ANGLE, SITE_SIZE, type Site, shootingStar } from './sparkle'

// What the sites pass reads back for one cell: where the clump is across
// the cell (0 to 1), how thick the gold is and its radius over 4, in bytes.
function cell(x: number, y: number, gold: number, radius = 0.5) {
  return [x, y, gold, radius].map((value) => Math.round(value * 255))
}

/** @see docs/background.md § "Sparkle" - glints land on real clumps */
describe('decodeSites', () => {
  it('places each clump on the page from its cell and where it sits in it', () => {
    const scale = 0.5
    const span = SITE_SIZE / scale + 2 * SITE_SLACK
    const bytes = new Uint8Array([...cell(0, 0, 0), ...cell(0.5, 0.25, 1)])
    const [site] = decodeSites(bytes, 2, 1, 1000, scale)
    expect(site.x).toBeCloseTo(SITE_SIZE + (0.5 * span - SITE_SLACK) * scale, 0)
    expect(site.y).toBeCloseTo(1000 + (0.25 * span - SITE_SLACK) * scale, 0)
    expect(site.gold).toBe(1)
  })

  it('leaves out cells with no clump', () => {
    const bytes = new Uint8Array([...cell(0.5, 0.5, 0), ...cell(0.5, 0.5, 0)])
    expect(decodeSites(bytes, 1, 2, 0, 1)).toEqual([])
  })

  it('counts a clump found from both sides of an edge once', () => {
    // Just past the right of the first cell, and just before the left of the next.
    const span = SITE_SIZE + 2 * SITE_SLACK
    const right = (SITE_SIZE + SITE_SLACK + 1) / span
    const left = (SITE_SLACK + 1) / span
    const bytes = new Uint8Array([...cell(right, 0.5, 0.8), ...cell(left, 0.5, 0.8)])
    expect(decodeSites(bytes, 2, 1, 0, 1)).toHaveLength(1)
  })
})

describe('pickSite', () => {
  const view = { top: 1000, width: 800, height: 600 }
  const site = (x: number, y: number, gold = 1): Site => ({ x, y, gold, radius: 1 })

  it('only picks what the window shows', () => {
    const above = site(100, 900)
    const shown = site(100, 1200)
    const right = site(900, 1200)
    for (const roll of [0, 0.5, 0.999]) expect(pickSite([above, shown, right], view, () => roll)).toBe(shown)
  })

  it('favours the thick of a vein', () => {
    const thin = site(100, 1100, 0.1)
    const thick = site(200, 1100, 1)
    let picks = 0
    for (let roll = 0; roll < 1; roll += 0.01) if (pickSite([thin, thick], view, () => roll) === thick) picks++
    expect(picks).toBeGreaterThan(95)
  })

  it('never glints the same clump twice at once', () => {
    const busy = site(100, 1100)
    const free = site(200, 1100, 0.1)
    expect(pickSite([busy, free], view, () => 0, new Set([busy]))).toBe(free)
  })

  it('has nothing to pick where the window shows no gold', () => {
    expect(pickSite([site(100, 0)], view, Math.random)).toBeNull()
  })
})

/** @see docs/background.md § "Sparkle" - shooting stars */
describe('shootingStar', () => {
  it('starts in the window and falls along the streaks', () => {
    const view = { top: 500, width: 1000, height: 800 }
    for (const roll of [0, 0.5, 0.999]) {
      const star = shootingStar(view, () => roll)
      expect(star.x).toBeGreaterThanOrEqual(0)
      expect(star.x).toBeLessThanOrEqual(view.width)
      expect(star.y).toBeGreaterThanOrEqual(view.top)
      expect(star.y).toBeLessThanOrEqual(view.top + view.height)
      expect(Math.abs(star.angle - SHOOTING_STAR_ANGLE)).toBeLessThanOrEqual(8)
    }
  })
})
