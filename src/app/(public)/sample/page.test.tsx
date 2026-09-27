import type { ComponentProps, ReactElement } from 'react'
import type DeckBuilder from '@/components/DeckBuilder'
import { starterCards } from '@/data/starter-cards'
import SampleDeck from './page'

vi.mock('server-only', () => ({}))
vi.mock('next/server', () => import('@/test/next'))

async function open() {
  return ((await SampleDeck()) as ReactElement<ComponentProps<typeof DeckBuilder>>).props
}

/** @see docs/sample-deck.md § "The deck" */
describe('the sample deck page', () => {
  it('hands the builder the starter ideas, as the sample deck', async () => {
    const props = await open()
    expect(props).toMatchObject({ deckName: 'Sample Deck', shareId: 'sample', sample: true })
    expect(props.cards.map((card) => card.title)).toEqual(starterCards.map((card) => card.title))
    expect(props.cards[0]).toMatchObject({ id: 'picnic-in-the-park', tags: starterCards[0].tags })
  })

  it('gives every card its own id', async () => {
    const ids = (await open()).cards.map((card) => card.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('shuffles it differently on each visit', async () => {
    const seeds = new Set<number>()
    for (let visit = 0; visit < 5; visit++) seeds.add((await open()).seed)
    expect(seeds.size).toBeGreaterThan(1)
  })

  it('offers no way to edit the deck', async () => {
    const props = await open()
    expect(props.editHref).toBeUndefined()
    expect(props.deckId).toBeUndefined()
    expect(props.plans).toBeUndefined()
  })
})
