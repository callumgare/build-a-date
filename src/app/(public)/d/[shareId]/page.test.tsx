import type { ComponentProps, ReactElement } from 'react'
import type PlanBuilder from '@/components/PlanBuilder'
import * as decks from '@/lib/decks'
import { previewKey } from '@/lib/og/preview-key'
import { saveDeckSort } from '@/lib/preferences'
import { savePreview } from '@/lib/previews'
import { useTestDb } from '@/test/cloudflare'
import { createTestDb, createUser } from '@/test/db'
import { fakeJpeg } from '@/test/jpeg'
import { NotFoundPage } from '@/test/next'
import { signInAs } from '@/test/session'
import SharedDeck, { generateMetadata } from './page'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => import('@/test/next'))
vi.mock('next/headers', () => import('@/test/next'))
vi.mock('next/server', () => import('@/test/next'))
vi.mock('@opennextjs/cloudflare', () => import('@/test/cloudflare'))
vi.mock('@/db', () => import('@/test/cloudflare'))
vi.mock('@/lib/auth-config', () => import('@/test/session'))

let db: ReturnType<typeof createTestDb>
let deck: Awaited<ReturnType<typeof decks.createDeck>>

function signIn(id: string) {
  signInAs({ id, name: id, email: `${id}@example.com` })
}

async function open(shareId = deck.shareId) {
  const page = (await SharedDeck({
    params: Promise.resolve({ shareId }),
  } as PageProps<'/d/[shareId]'>)) as ReactElement<ComponentProps<typeof PlanBuilder>>
  return page.props
}

beforeEach(async () => {
  db = createTestDb()
  useTestDb(db)
  signInAs(null)
  for (const id of ['owner', 'helper', 'asker']) await createUser(db, id)
  deck = await decks.createDeck(db, 'owner', { name: 'Weekend', template: 'empty' })
  await decks.saveCard(db, 'owner', deck.id, null, { title: 'Picnic' })
})

describe('the shared deck page', () => {
  it('hands the deck to anyone, signed in or not', async () => {
    const props = await open()
    expect(props).toMatchObject({ deckName: 'Weekend', shareId: deck.shareId, access: 'none', editHref: undefined })
    expect(props.cards.map((card) => card.title)).toEqual(['Picnic'])
  })

  /** @see docs/deck-sorting.md § "Sort options" - Random is a new shuffle on every visit */
  it('shuffles it differently on each visit', async () => {
    const seeds = new Set<number>()
    for (let visit = 0; visit < 5; visit++) seeds.add((await open()).seed)
    expect(seeds.size).toBeGreaterThan(1)
  })

  /** @see docs/deck-sharing.md § "Asking for edit access" - owners and editors see Edit this deck */
  it("links owners and editors to the deck's edit page, and only them", async () => {
    await decks.requestEditAccess(db, 'helper', deck.shareId)
    await decks.respondToAccessRequest(db, 'owner', deck.id, 'helper', true)
    await decks.requestEditAccess(db, 'asker', deck.shareId)

    signIn('owner')
    expect(await open()).toMatchObject({ access: 'owner', editHref: `/decks/${deck.id}` })
    signIn('helper')
    expect(await open()).toMatchObject({ access: 'editor', editHref: `/decks/${deck.id}` })
    signIn('asker')
    expect(await open()).toMatchObject({ access: 'pending', editHref: undefined })
  })

  /** @see docs/deck-sharing.md § "Who can do what" - owners and editors see the deck's plans */
  it("hands the deck's plans to owners and editors, and only them", async () => {
    const [picnic] = (await open()).cards
    await decks.savePlan(db, deck.shareId, [picnic.id])
    await decks.requestEditAccess(db, 'helper', deck.shareId)
    await decks.respondToAccessRequest(db, 'owner', deck.id, 'helper', true)
    await decks.requestEditAccess(db, 'asker', deck.shareId)

    expect((await open()).plans).toBeUndefined()
    for (const id of ['owner', 'helper']) {
      signIn(id)
      expect((await open()).plans).toMatchObject([{ cards: 1 }])
    }
    signIn('asker')
    expect((await open()).plans).toBeUndefined()
  })

  /** @see docs/deck-filters.md § "Not in plan" - the planned ideas go to anyone building a plan */
  it("hands the ideas the deck's saved plans have used to anyone", async () => {
    const [picnic] = (await open()).cards
    await decks.savePlan(db, deck.shareId, [], [{ id: 'g', title: 'Out', notes: '', cardIds: [picnic.id] }])

    expect((await open()).plannedCardIds).toEqual([picnic.id])
  })

  /** @see docs/card-notes.md § "Editing a card" - only people who can edit get the deck's id */
  it('lets owners and editors edit cards from the page, and only them', async () => {
    await decks.requestEditAccess(db, 'helper', deck.shareId)
    await decks.respondToAccessRequest(db, 'owner', deck.id, 'helper', true)
    await decks.requestEditAccess(db, 'asker', deck.shareId)

    expect((await open()).deckId).toBeUndefined()
    signIn('owner')
    expect((await open()).deckId).toBe(deck.id)
    signIn('helper')
    expect((await open()).deckId).toBe(deck.id)
    signIn('asker')
    expect((await open()).deckId).toBeUndefined()
  })

  /** @see docs/deck-sorting.md § "Remembering the choice" */
  it('starts signed-in visitors on the sort they last picked, and saves picks only for them', async () => {
    expect(await open()).toMatchObject({ initialSort: 'random', remembersSort: false })
    signIn('helper')
    expect(await open()).toMatchObject({ initialSort: 'random', remembersSort: true })
    await saveDeckSort(db, 'helper', 'interest')
    expect(await open()).toMatchObject({ initialSort: 'interest', remembersSort: true })
  })

  it("shows the not-found page for a deck that doesn't exist", async () => {
    await expect(open('nope')).rejects.toThrow(NotFoundPage)
  })

  it('is titled with the deck name', async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ shareId: deck.shareId }),
    } as PageProps<'/d/[shareId]'>)
    expect(metadata).toMatchObject({ title: 'Weekend' })
  })

  /** @see docs/share-previews.md § "The page's metadata" */
  it('describes itself for link previews, with a large picture at an absolute address', async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ shareId: deck.shareId }),
    } as PageProps<'/d/[shareId]'>)
    expect(metadata.metadataBase).toEqual(new URL('http://localhost:3000'))
    expect(metadata.openGraph).toMatchObject({
      title: 'Weekend',
      description: expect.stringContaining('Weekend'),
      url: `/d/${deck.shareId}`,
    })
    expect(metadata.twitter).toMatchObject({ card: 'summary_large_image', title: 'Weekend' })
  })

  /** @see docs/share-previews.md § "The page's metadata" */
  it("points link previews at the deck's picture, or the default until there is one", async () => {
    const metadata = () =>
      generateMetadata({ params: Promise.resolve({ shareId: deck.shareId }) } as PageProps<'/d/[shareId]'>)
    const image = async () => {
      const { openGraph, twitter } = await metadata()
      const [og] = (openGraph?.images ?? []) as { url: string }[]
      const [tw] = (twitter?.images ?? []) as { url: string }[]
      expect(tw.url).toBe(og.url)
      return og
    }
    expect(await image()).toMatchObject({ url: '/og/default.jpg', width: 1200, height: 630, type: 'image/jpeg' })
    await savePreview(db, 'deck', deck.id, 'abc', fakeJpeg())
    expect((await image()).url).toBe(`/d/${deck.shareId}/preview?v=abc`)
  })

  /** @see docs/share-previews.md § "When it's drawn" - owners and editors redraw a deck's picture */
  it("hands owners and editors what the deck's picture should show, and only them", async () => {
    expect((await open()).preview).toBeUndefined()
    signIn('owner')
    const { preview } = await open()
    expect(preview).toEqual({
      kind: 'deck',
      id: deck.id,
      input: { title: 'Weekend', cards: [{ id: expect.any(String), title: 'Picnic' }], layout: 'grid' },
      stored: null,
    })
    if (!preview) throw new Error('No preview')
    await savePreview(db, 'deck', deck.id, previewKey(preview.input), fakeJpeg())
    expect((await open()).preview?.stored).toBe(previewKey(preview.input))
  })
})
