import type { ComponentProps, ReactElement } from 'react'
import type DeckEditor from '@/components/decks/DeckEditor'
import * as decks from '@/lib/decks'
import { useTestDb } from '@/test/cloudflare'
import { createTestDb, createUser } from '@/test/db'
import { NotFoundPage } from '@/test/next'
import { signInAs } from '@/test/session'
import DeckPage from './page'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => import('@/test/next'))
vi.mock('next/headers', () => import('@/test/next'))
vi.mock('@opennextjs/cloudflare', () => import('@/test/cloudflare'))
vi.mock('@/db', () => import('@/test/cloudflare'))
vi.mock('@/lib/auth-config', () => import('@/test/session'))

let db: ReturnType<typeof createTestDb>
let deck: Awaited<ReturnType<typeof decks.createDeck>>

function signIn(id: string) {
  signInAs({ id, name: id, email: `${id}@example.com` })
}

async function open(deckId = deck.id) {
  const page = (await DeckPage({
    params: Promise.resolve({ deckId }),
  } as PageProps<'/decks/[deckId]'>)) as ReactElement<ComponentProps<typeof DeckEditor>>
  return page.props
}

beforeEach(async () => {
  db = createTestDb()
  useTestDb(db)
  for (const id of ['owner', 'helper', 'asker']) await createUser(db, id)
  deck = await decks.createDeck(db, 'owner', { name: 'Weekend', template: 'empty' })
  await decks.requestEditAccess(db, 'helper', deck.shareId)
  await decks.respondToAccessRequest(db, 'owner', deck.id, 'helper', true)
  await decks.requestEditAccess(db, 'asker', deck.shareId)
  signIn('owner')
})

/** @see docs/deck-sharing.md § "Who can do what" */
describe("the deck's edit page", () => {
  it('shows the owner who can edit and who is asking, with the share link', async () => {
    const props = await open()
    expect(props.role).toBe('owner')
    expect(props.shareUrl).toBe(`http://localhost:3000/d/${deck.shareId}`)
    expect(props.access).toHaveLength(2)
    expect(props.access).toEqual(
      expect.arrayContaining([
        { userId: 'helper', name: 'helper', email: 'helper@example.com', status: 'accepted' },
        { userId: 'asker', name: 'asker', email: 'asker@example.com', status: 'pending' },
      ]),
    )
  })

  it('lets an editor in, without showing them who else can edit', async () => {
    signIn('helper')
    expect(await open()).toMatchObject({ role: 'editor', access: [] })
  })

  /** @see docs/deck-sharing.md § "Who can do what" - a pending request gives nothing beyond what anyone with the link has */
  it('shows the not-found page to anyone else, including someone still asking', async () => {
    for (const id of ['asker', 'stranger']) {
      signIn(id)
      await expect(open()).rejects.toThrow(NotFoundPage)
    }
    signIn('owner')
    await expect(open('nope')).rejects.toThrow(NotFoundPage)
  })

  it('sends someone signed out to sign in', async () => {
    signInAs(null)
    await expect(open()).rejects.toThrow(/^Redirected to \/sign-in$/)
  })
})
