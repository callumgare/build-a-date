import { cardInput } from '@/lib/validation'
import { starterCards, starterTags } from './starter-cards'

describe('starterCards', () => {
  it('has around 30 ideas', () => {
    expect(starterCards.length).toBeGreaterThanOrEqual(25)
  })

  it('has unique titles', () => {
    const titles = starterCards.map((card) => card.title)
    expect(new Set(titles).size).toBe(titles.length)
  })

  it('only uses the shared tags', () => {
    for (const card of starterCards) {
      for (const tag of card.tags) expect(starterTags).toContain(tag)
    }
  })

  it('passes the same validation as cards people write', () => {
    for (const card of starterCards) expect(() => cardInput.parse(card)).not.toThrow()
  })

  it('stays location-agnostic: no links or dates', () => {
    for (const card of starterCards) {
      expect(card.description).not.toMatch(/https?:/)
      expect(card.date).toBeUndefined()
    }
  })
})
