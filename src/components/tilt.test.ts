import { leanOf, maxRotate, minRotate, randomTilt, untiltedBox } from './tilt'

/** @see docs/card-layout.md § "Tilting on hover" */
describe('randomTilt', () => {
  // Stands in for Math.random, handing out `values` in turn.
  function sequence(...values: number[]) {
    let index = 0
    return () => values[index++ % values.length]
  }

  it('keeps every lean small but noticeable', () => {
    for (const value of [0, 0.25, 0.5, 0.75, 0.999]) {
      const lean = Math.abs(randomTilt(sequence(0.2, value)))
      expect(lean).toBeGreaterThanOrEqual(minRotate)
      expect(lean).toBeLessThanOrEqual(maxRotate)
    }
  })

  it('tips cards both ways', () => {
    expect(randomTilt(sequence(0.2, 0.5))).toBeLessThan(0)
    expect(randomTilt(sequence(0.8, 0.5))).toBeGreaterThan(0)
  })

  it('picks a different lean each time', () => {
    const leans = new Set(Array.from({ length: 20 }, () => randomTilt()))
    expect(leans.size).toBeGreaterThan(1)
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
