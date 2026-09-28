import type { PreviewInput } from './preview'
import { previewKey } from './preview-key'

const cards = Array.from({ length: 12 }, (_, index) => ({ id: `card-${index}`, title: `Idea ${index}` }))
const deck: PreviewInput = { title: 'Weekend', cards, layout: 'grid' }

/** @see docs/share-previews.md § "When it's drawn" */
describe('previewKey', () => {
  it('is the same for the same picture', () => {
    expect(previewKey(deck)).toBe(previewKey({ ...deck, cards: cards.map((card) => ({ ...card })) }))
  })

  it('changes with anything the picture shows', () => {
    const key = previewKey(deck)
    expect(previewKey({ ...deck, title: 'Weekends' })).not.toBe(key)
    expect(previewKey({ ...deck, layout: 'fan' })).not.toBe(key)
    expect(previewKey({ ...deck, cards: [{ ...cards[0], title: 'Picnic' }, ...cards.slice(1)] })).not.toBe(key)
    expect(previewKey({ ...deck, cards: [{ ...cards[0], date: 'Sat 4 Oct' }, ...cards.slice(1)] })).not.toBe(key)
    expect(previewKey({ ...deck, cards: [cards[1], cards[0], ...cards.slice(2)] })).not.toBe(key)
  })

  it("doesn't change for cards off the edge of the picture", () => {
    // A deck's grid draws 10 cards, a plan's fan 9.
    expect(previewKey({ ...deck, cards: cards.slice(0, 10) })).toBe(previewKey(deck))
    expect(previewKey({ ...deck, cards: cards.slice(0, 9) })).not.toBe(previewKey(deck))
    const plan: PreviewInput = { ...deck, layout: 'fan' }
    expect(previewKey({ ...plan, cards: cards.slice(0, 9) })).toBe(previewKey(plan))
  })
})
