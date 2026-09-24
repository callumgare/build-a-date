import { cardInput, cardNotesInput, newDeckInput, planInput, safeNextPath } from './validation'

describe('cardInput', () => {
  it('trims, lowercases and dedupes tags', () => {
    expect(cardInput.parse({ title: ' Picnic ', tags: ['Outside', 'outside ', ' Free'] })).toEqual({
      title: 'Picnic',
      description: '',
      tags: ['outside', 'free'],
      date: null,
    })
  })

  it('turns an empty date into null', () => {
    expect(cardInput.parse({ title: 'Picnic', date: '  ' }).date).toBeNull()
  })

  it('needs a title', () => {
    expect(() => cardInput.parse({ title: '   ' })).toThrow('Give the idea a title')
  })

  it('caps the number of tags', () => {
    expect(() => cardInput.parse({ title: 'x', tags: Array.from({ length: 9 }, (_, i) => `t${i}`) })).toThrow()
  })
})

/** @see docs/card-notes.md § "Rating and notes" */
describe('cardNotesInput', () => {
  const base = { shareId: 'share', cardId: 'card', interest: null, notes: '' }

  it('takes a rating of 1 to 5 stars, or none', () => {
    for (const interest of [null, 1, 5]) expect(cardNotesInput.parse({ ...base, interest }).interest).toBe(interest)
    for (const interest of [0, 6, 2.5]) expect(() => cardNotesInput.parse({ ...base, interest })).toThrow()
  })

  it('trims notes and caps them at 2000 characters', () => {
    expect(cardNotesInput.parse({ ...base, notes: '  Bring snacks \n' }).notes).toBe('Bring snacks')
    expect(() => cardNotesInput.parse({ ...base, notes: 'x'.repeat(2001) })).toThrow('up to 2000 characters')
  })
})

describe('newDeckInput', () => {
  it('only accepts known templates', () => {
    expect(() => newDeckInput.parse({ name: 'Deck', template: 'everything' })).toThrow()
    expect(newDeckInput.parse({ name: ' Deck ', template: 'empty' })).toEqual({ name: 'Deck', template: 'empty' })
  })
})

describe('planInput', () => {
  it('needs at least one card', () => {
    expect(() => planInput.parse({ shareId: 'abc', cardIds: [] })).toThrow()
  })
})

/** @see docs/deck-sharing.md § "Returning after sign-in" */
describe('safeNextPath', () => {
  it('keeps paths on this site', () => {
    expect(safeNextPath('/d/abc/request')).toBe('/d/abc/request')
    expect(safeNextPath('/decks?tab=shared')).toBe('/decks?tab=shared')
  })

  it.each([
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    '/\t/evil.example',
    'decks',
    '',
    undefined,
    ['/decks'],
  ])('refuses %j', (next) => {
    expect(safeNextPath(next)).toBeUndefined()
  })
})
