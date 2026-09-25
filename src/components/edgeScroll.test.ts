import { edgeRamp, edgeScrollSpeed, edgeZone, maxScrollSpeed } from './edgeScroll'

/** @see docs/card-layout.md § "Reordering the plan" - scrolls with the drag */
describe('edgeScrollSpeed', () => {
  const track = { left: 0, right: 1000 }

  it("doesn't scroll while the card is well inside the track", () => {
    expect(edgeScrollSpeed({ left: 400, right: 600 }, track, 50)).toBe(0)
    expect(edgeScrollSpeed({ left: 400, right: 600 }, track, -50)).toBe(0)
  })

  it('scrolls towards the end the card is dragged up to', () => {
    expect(edgeScrollSpeed({ left: 800, right: 1000 }, track, 50)).toBeGreaterThan(0)
    expect(edgeScrollSpeed({ left: 0, right: 200 }, track, -50)).toBeLessThan(0)
  })

  it('scrolls faster the further past the edge the card goes, up to a limit', () => {
    const justIn = edgeScrollSpeed({ left: 780, right: 1000 - edgeZone + 10 }, track, 50)
    const further = edgeScrollSpeed({ left: 800, right: 1000 - edgeZone + 60 }, track, 50)
    expect(further).toBeGreaterThan(justIn)
    expect(edgeScrollSpeed({ left: 900, right: 1000 - edgeZone + edgeRamp * 3 }, track, 50)).toBe(maxScrollSpeed)
  })

  it("doesn't scroll for a card near an edge that it hasn't been dragged towards", () => {
    expect(edgeScrollSpeed({ left: 800, right: 1000 }, track, -20)).toBe(0)
    expect(edgeScrollSpeed({ left: 0, right: 200 }, track, 20)).toBe(0)
    expect(edgeScrollSpeed({ left: 800, right: 1000 }, track, 0)).toBe(0)
  })
})
