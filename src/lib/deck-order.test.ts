import { frameFor } from '@/components/frames'
import type { DateCard } from '@/types'
import { arrangeDeck, shuffle, spreadFrames } from './deck-order'

const cards: DateCard[] = Array.from({ length: 40 }, (_, index) => ({
  id: `card-${index}`,
  title: `Card ${index}`,
  description: '',
  tags: [],
}))

describe('shuffle', () => {
  it('gives the same order for the same seed', () => {
    expect(shuffle(cards, 42)).toEqual(shuffle(cards, 42))
  })

  it('gives a different order for a different seed', () => {
    expect(shuffle(cards, 1)).not.toEqual(shuffle(cards, 2))
  })

  it('keeps every card exactly once', () => {
    expect(
      shuffle(cards, 7)
        .map((card) => card.id)
        .sort(),
    ).toEqual(cards.map((card) => card.id).sort())
  })

  it('leaves the input alone', () => {
    const copy = [...cards]
    shuffle(cards, 3)
    expect(cards).toEqual(copy)
  })
})

describe('spreadFrames', () => {
  it('never puts matching frames side by side when there are enough frames to go round', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const spread = spreadFrames(shuffle(cards, seed))
      expect(spread).toHaveLength(cards.length)
      for (let index = 1; index < spread.length; index++) {
        expect(frameFor(spread[index].id)).not.toBe(frameFor(spread[index - 1].id))
      }
    }
  })
})

describe('arrangeDeck', () => {
  it('is deterministic per seed, so server and browser agree', () => {
    expect(arrangeDeck(cards, 99)).toEqual(arrangeDeck(cards, 99))
  })
})
