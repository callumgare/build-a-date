import { frameFor } from '@/components/frames'
import type { DateCard } from '@/types'
import { arrangeDeck, keepArrangement, shuffle, sortDeck, spreadFrames } from './deck-order'

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

  it('keeps every card exactly once when frames have to repeat', () => {
    const sameFrame = cards.filter((card) => frameFor(card.id) === frameFor(cards[0].id)).slice(0, 3)
    const few = [...sameFrame, cards.find((card) => frameFor(card.id) !== frameFor(cards[0].id)) as DateCard]
    expect(sameFrame.length).toBeGreaterThan(1)

    for (const deck of [few, sameFrame, cards.slice(0, 1), []]) {
      expect(
        spreadFrames(deck)
          .map((card) => card.id)
          .sort(),
      ).toEqual(deck.map((card) => card.id).sort())
    }
  })
})

describe('arrangeDeck', () => {
  it('is deterministic per seed, so server and browser agree', () => {
    expect(arrangeDeck(cards, 99)).toEqual(arrangeDeck(cards, 99))
  })
})

/** @see docs/deck-sorting.md § "Sort options" */
/** @see docs/card-notes.md § "Editing a card" - the deck doesn't shuffle again */
describe('keepArrangement', () => {
  const [a, b, c] = cards

  it('keeps cards where they were, with their new text', () => {
    expect(keepArrangement([c, a, b], [a, { ...b, title: 'Edited' }, c])).toEqual([c, a, { ...b, title: 'Edited' }])
  })

  it('puts new cards first, newest first', () => {
    const [d, e] = cards.slice(3, 5)
    expect(keepArrangement([b, a], [a, b, d, e])).toEqual([e, d, b, a])
  })

  it('drops deleted cards', () => {
    expect(keepArrangement([c, a, b], [a, b])).toEqual([a, b])
  })
})

/** @see docs/deck-sorting.md § "Sort options" */
describe('sortDeck', () => {
  const added = cards.slice(0, 6)
  const arranged = arrangeDeck(added, 5)
  const ratings = new Map<string, number | null>([
    ['card-0', 3],
    ['card-1', 5],
    ['card-3', 3],
    ['card-4', null],
  ])
  const interest = (id: string) => ratings.get(id) ?? null
  const ids = (sorted: DateCard[]) => sorted.map((card) => card.id)

  it('keeps the shuffled order for Random', () => {
    expect(sortDeck('random', { added, arranged, interest })).toEqual(arranged)
  })

  it('puts the newest first for Date added', () => {
    expect(ids(sortDeck('added', { added, arranged, interest }))).toEqual([
      'card-5',
      'card-4',
      'card-3',
      'card-2',
      'card-1',
      'card-0',
    ])
  })

  it('puts the most stars first for Interest, unrated last, ties by title', () => {
    expect(ids(sortDeck('interest', { added, arranged, interest }))).toEqual([
      'card-1',
      'card-0',
      'card-3',
      'card-2',
      'card-4',
      'card-5',
    ])
  })

  it('orders ties by title ignoring case, with numbers in number order', () => {
    const titled = ['b idea', 'Card 10', 'A idea', 'Card 2'].map((title, index) => ({ ...cards[index], title }))
    const sorted = sortDeck('interest', { added: titled, arranged: titled, interest: () => 4 })
    expect(sorted.map((card) => card.title)).toEqual(['A idea', 'b idea', 'Card 2', 'Card 10'])
  })

  it('leaves the input alone', () => {
    const copy = [...added]
    sortDeck('added', { added, arranged, interest })
    expect(added).toEqual(copy)
  })
})
