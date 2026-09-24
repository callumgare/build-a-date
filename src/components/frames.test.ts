import { frameFor, frames } from './frames'

describe('frameFor', () => {
  it('always gives a card the same frame', () => {
    expect(frameFor('picnic')).toBe(frameFor('picnic'))
  })

  it('uses every frame across enough cards', () => {
    const used = new Set(Array.from({ length: 500 }, (_, index) => frameFor(`card-${index}`)))
    expect(used.size).toBe(frames.length)
  })
})
