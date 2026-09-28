import type { ComponentProps, ReactElement } from 'react'
import type PlanBuilder from '@/components/PlanBuilder'
import { starterCards } from '@/data/starter-cards'
import SampleDeck, { generateMetadata } from './page'

vi.mock('server-only', () => ({}))
vi.mock('next/server', () => import('@/test/next'))
vi.mock('@opennextjs/cloudflare', () => import('@/test/cloudflare'))

async function open() {
  return ((await SampleDeck()) as ReactElement<ComponentProps<typeof PlanBuilder>>).props
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

  /** @see docs/share-previews.md § "The page's metadata" */
  it('describes itself for link previews, with a large picture at an absolute address', () => {
    const metadata = generateMetadata()
    expect(metadata).toMatchObject({ title: 'Sample deck', twitter: { card: 'summary_large_image' } })
    expect(metadata.metadataBase).toEqual(new URL('http://localhost:3000'))
    expect(metadata.openGraph).toMatchObject({ url: '/sample' })
    // Drawn once and kept in public/og/ (docs/share-previews.md § "The static pictures").
    expect(metadata.openGraph?.images).toMatchObject([{ url: '/og/sample.jpg', width: 1200, height: 630 }])
  })
})
