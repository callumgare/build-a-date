import { dragLean, entryLean, leanOf, maxDragRotate, maxRotate, minRotate, untiltedBox } from './tilt'

/** @see docs/card-layout.md § "Tilting on hover" - away from where the mouse came in */
describe('entryLean', () => {
  // A 150 × 200 card with its top left corner at (100, 100).
  const card = { left: 100, top: 100, width: 150, height: 200 }

  it('tips the top away from a mouse coming in near the top of either side', () => {
    expect(entryLean({ x: 100, y: 110 }, card, { x: 4, y: 0 })).toBeGreaterThan(0)
    expect(entryLean({ x: 250, y: 110 }, card, { x: -4, y: 0 })).toBeLessThan(0)
  })

  it('tips the bottom away from a mouse coming in near the bottom of either side', () => {
    expect(entryLean({ x: 100, y: 290 }, card, { x: 4, y: 0 })).toBeLessThan(0)
    expect(entryLean({ x: 250, y: 290 }, card, { x: -4, y: 0 })).toBeGreaterThan(0)
  })

  it('tips the side a mouse comes down onto away from it', () => {
    expect(entryLean({ x: 110, y: 100 }, card, { x: 0, y: 4 })).toBeLessThan(0)
    expect(entryLean({ x: 240, y: 100 }, card, { x: 0, y: 4 })).toBeGreaterThan(0)
  })

  it('tips further the nearer the corner the mouse comes in', () => {
    const nearCorner = entryLean({ x: 100, y: 100 }, card, { x: 4, y: 0 })
    const nearMiddle = entryLean({ x: 100, y: 180 }, card, { x: 4, y: 0 })
    expect(nearCorner).toBeGreaterThan(nearMiddle)
    expect(nearMiddle).toBeGreaterThan(0)
  })

  it('keeps every lean small', () => {
    for (const [x, y] of [
      [100, 100],
      [250, 300],
      [175, 100],
      [100, 200],
    ]) {
      for (const movement of [{ x: 5, y: -3 }, { x: -1, y: 9 }, undefined]) {
        const lean = Math.abs(entryLean({ x, y }, card, movement))
        if (lean) expect(lean).toBeGreaterThanOrEqual(minRotate)
        expect(lean).toBeLessThanOrEqual(maxRotate)
      }
    }
  })

  it('lifts a card straight when the mouse comes straight at the middle of an edge', () => {
    expect(entryLean({ x: 100, y: 200 }, card, { x: 4, y: 0 })).toBe(0)
    expect(entryLean({ x: 175, y: 100 }, card, { x: 0, y: 4 })).toBe(0)
  })

  it('takes the push as straight in from the nearest edge when the mouse gave no movement', () => {
    expect(entryLean({ x: 100, y: 110 }, card)).toBe(entryLean({ x: 100, y: 110 }, card, { x: 1, y: 0 }))
    expect(entryLean({ x: 240, y: 100 }, card, { x: 0, y: 0 })).toBe(
      entryLean({ x: 240, y: 100 }, card, { x: 0, y: 1 }),
    )
  })
})

/** @see docs/card-layout.md § "Reordering the plan" - leans back from the drag */
describe('dragLean', () => {
  it('leans the top of a card back from the way it is dragged', () => {
    expect(dragLean(600)).toBeLessThan(0)
    expect(dragLean(-600)).toBeGreaterThan(0)
  })

  it('leans further the faster it goes, up to a limit', () => {
    expect(Math.abs(dragLean(900))).toBeGreaterThan(Math.abs(dragLean(300)))
    expect(dragLean(100_000)).toBe(-maxDragRotate)
    expect(dragLean(-100_000)).toBe(maxDragRotate)
  })

  it('stands a card that has stopped straight', () => {
    expect(dragLean(0)).toBe(0)
  })
})

describe('leanOf', () => {
  it('reads the angle out of a computed transform', () => {
    const radians = (1.5 * Math.PI) / 180
    const [cos, sin] = [Math.cos(radians), Math.sin(radians)]
    expect(leanOf(`matrix(${cos}, ${sin}, ${-sin}, ${cos}, 0, 0)`)).toBeCloseTo(1.5)
    expect(leanOf(`matrix(${cos}, ${-sin}, ${sin}, ${cos}, 12, 4)`)).toBeCloseTo(-1.5)
  })

  it('reads the angle of a card that is also scaled', () => {
    const radians = (-2 * Math.PI) / 180
    const [cos, sin] = [0.5 * Math.cos(radians), 0.5 * Math.sin(radians)]
    expect(leanOf(`matrix(${cos}, ${sin}, ${-sin}, ${cos}, 0, 0)`)).toBeCloseTo(-2)
  })

  it('takes a card with no transform as straight', () => {
    expect(leanOf('none')).toBe(0)
    expect(leanOf('')).toBe(0)
  })
})

describe('untiltedBox', () => {
  // A 150 × 200 card with its centre at (175, 200), leaning `rotate` degrees.
  function leaningCard(rotate: number, scale = 1) {
    const radians = (Math.abs(rotate) * Math.PI) / 180
    const width = scale * (150 * Math.cos(radians) + 200 * Math.sin(radians))
    const height = scale * (150 * Math.sin(radians) + 200 * Math.cos(radians))
    return {
      offsetWidth: 150,
      offsetHeight: 200,
      getBoundingClientRect: () => ({ left: 175 - width / 2, top: 200 - height / 2, width, height }),
    } as unknown as Element
  }

  it('gives the size of the card itself, not the box its corners lean out to', () => {
    const box = untiltedBox(leaningCard(-1.5), -1.5)
    expect(box.width).toBeCloseTo(150)
    expect(box.height).toBeCloseTo(200)
    expect(box.left).toBeCloseTo(100)
    expect(box.top).toBeCloseTo(100)
    expect(box.rotate).toBe(-1.5)
  })

  it('gives the size a card is drawn at while it is scaled', () => {
    const box = untiltedBox(leaningCard(1.2, 0.5), 1.2)
    expect(box.width).toBeCloseTo(75)
    expect(box.height).toBeCloseTo(100)
  })

  it('leaves a straight card as it is', () => {
    const box = untiltedBox(leaningCard(0), 0)
    expect(box).toMatchObject({ left: 100, top: 100, width: 150, height: 200, rotate: 0 })
  })
})
