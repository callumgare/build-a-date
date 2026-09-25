import type { ComponentProps, ReactElement } from 'react'
import type DeckBuilder from '@/components/DeckBuilder'
import * as decks from '@/lib/decks'
import { useTestDb } from '@/test/cloudflare'
import { createTestDb, createUser } from '@/test/db'
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
  } as PageProps<'/d/[shareId]'>)) as ReactElement<ComponentProps<typeof DeckBuilder>>
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

  it("shows the not-found page for a deck that doesn't exist", async () => {
    await expect(open('nope')).rejects.toThrow(NotFoundPage)
  })

  it('is titled with the deck name', async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ shareId: deck.shareId }),
    } as PageProps<'/d/[shareId]'>)
    expect(metadata).toMatchObject({ title: 'Weekend' })
  })
})
