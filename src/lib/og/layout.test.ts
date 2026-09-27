import { deckGrid, FAN, GRID, IMAGE, planFan } from './layout'

/** @see docs/share-previews.md § "A deck" */
describe('deckGrid', () => {
  it('puts a big deck in rows of 5, with the second running off the bottom', () => {
    const places = deckGrid(30)
    expect(places).toHaveLength(10)
    const rows = [...new Set(places.map((place) => place.y))]
    expect(rows).toHaveLength(2)
    expect(rows[1]).toBeLessThan(IMAGE.height)
    expect(rows[1] + GRID.height).toBeGreaterThan(IMAGE.height)
    expect(places.every((place) => place.rotate === 0)).toBe(true)
  })

  it('draws no row that would start below the picture', () => {
    expect(deckGrid(100).every((place) => place.y < IMAGE.height)).toBe(true)
  })

  it('centres the rows', () => {
    for (const count of [1, 3, 5, 10]) {
      const places = deckGrid(count)
      const left = Math.min(...places.map((place) => place.x))
      const right = Math.max(...places.map((place) => place.x + place.width))
      expect(left).toBeCloseTo(IMAGE.width - right)
    }
  })

  it('draws nothing for an empty deck', () => {
    expect(deckGrid(0)).toEqual([])
  })
})

/** @see docs/share-previews.md § "A plan" */
describe('planFan', () => {
  const centre = (place: { x: number; width: number }) => place.x + place.width / 2

  it('fans the picks out from the middle, first on the left', () => {
    const places = planFan(5)
    expect(places.map((place) => place.rotate)).toEqual([-32, -16, 0, 16, 32])
    for (let index = 1; index < places.length; index++) {
      expect(centre(places[index])).toBeGreaterThan(centre(places[index - 1]))
    }
  })

  it('is symmetric about the middle, with the outer cards dipping lower', () => {
    const places = planFan(4)
    expect(centre(places[0])).toBeCloseTo(IMAGE.width - centre(places[3]))
    expect(places[0].y).toBeCloseTo(places[3].y)
    expect(places[0].y).toBeGreaterThan(places[1].y)
  })

  it('never turns neighbouring cards more than 16° apart, nor the hand more than 72°', () => {
    for (const count of [2, 3, 6, 9]) {
      const angles = planFan(count).map((place) => place.rotate)
      expect(angles[1] - angles[0]).toBeLessThanOrEqual(FAN.maxStep)
      expect(angles[angles.length - 1] - angles[0]).toBeLessThanOrEqual(FAN.spread + 0.01)
    }
  })

  it('draws the first 9 picks at most', () => {
    expect(planFan(20)).toHaveLength(9)
  })

  it('stands a single pick up straight in the middle', () => {
    const [only] = planFan(1)
    expect(only.rotate).toBe(0)
    expect(centre(only)).toBe(IMAGE.width / 2)
  })
})
