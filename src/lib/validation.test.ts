import { cardInput, newDeckInput, planInput, safeNextPath } from './validation'

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
