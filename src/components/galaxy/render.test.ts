import { featureScale, overdrawSize } from './render'

/** @see docs/background.md § "How big it's drawn" */
describe('featureScale', () => {
  it('draws finer on a phone than on a laptop, as the stretched photo did', () => {
    expect(featureScale(390, 844)).toBe(0.45)
    expect(featureScale(1440, 900)).toBeCloseTo(0.65, 2)
  })

  it('goes by the longer side, so turning the phone makes no difference', () => {
    expect(featureScale(844, 390)).toBe(featureScale(390, 844))
  })

  it('stops growing on large monitors', () => {
    expect(featureScale(3840, 2160)).toBe(0.85)
  })
})

/** @see docs/background.md § "Overdrawn" */
describe('overdrawSize', () => {
  it('covers the whole screen, not just the window', () => {
    expect(overdrawSize({ width: 2560, height: 1440 }, { width: 1200, height: 800 }, false)).toEqual({
      width: 2560,
      height: 1440,
    })
  })

  it('covers the longer side both ways on something that can be turned', () => {
    expect(overdrawSize({ width: 390, height: 844 }, { width: 390, height: 700 }, true)).toEqual({
      width: 844,
      height: 844,
    })
  })

  it('covers a window bigger than the screen, as when zoomed out', () => {
    expect(overdrawSize({ width: 1440, height: 900 }, { width: 1800, height: 1000 }, false)).toEqual({
      width: 1800,
      height: 1000,
    })
  })
})
