/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react'
import * as decks from '@/lib/decks'
import { useTestDb } from '@/test/cloudflare'
import { createTestDb, createUser } from '@/test/db'
import { NotFoundPage } from '@/test/next'
import { signInAs } from '@/test/session'
import RequestAccess from './page'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => import('@/test/next'))
vi.mock('next/headers', () => import('@/test/next'))
vi.mock('next/cache', () => import('@/test/next'))
vi.mock('@opennextjs/cloudflare', () => import('@/test/cloudflare'))
vi.mock('@/db', () => import('@/test/cloudflare'))
vi.mock('@/lib/auth-config', () => import('@/test/session'))
vi.mock('next/link', () => ({ default: (props: object) => <a {...props} /> }))

let db: ReturnType<typeof createTestDb>
let deck: Awaited<ReturnType<typeof decks.createDeck>>

function signIn(id: string) {
  signInAs({ id, name: id, email: `${id}@example.com` })
}

async function open(shareId = deck.shareId) {
  return RequestAccess({ params: Promise.resolve({ shareId }) } as PageProps<'/d/[shareId]/request'>)
}

beforeEach(async () => {
  db = createTestDb()
  useTestDb(db)
  for (const id of ['owner', 'helper']) await createUser(db, id)
  deck = await decks.createDeck(db, 'owner', { name: 'Weekend', template: 'empty' })
  signIn('helper')
})

/** @see docs/deck-sharing.md § "Asking for edit access" */
describe('the request page', () => {
  it('asks for a press to send the request, saying what the owner will see', async () => {
    render(await open())
    expect(screen.getByRole('heading', { name: 'Weekend' })).toBeInTheDocument()
    expect(screen.getByText(/email them your name and email address/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send request' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to the deck' })).toHaveAttribute('href', `/d/${deck.shareId}`)
  })

  /** @see docs/deck-sharing.md § "Why sending takes a press" */
  it("doesn't send a request just by being opened", async () => {
    render(await open())
    expect(await decks.getAccessState(db, 'helper', deck)).toBe('none')
    expect(await decks.listDeckAccess(db, 'owner', deck.id)).toEqual([])
  })

  it('says so once they have asked', async () => {
    await decks.requestEditAccess(db, 'helper', deck.shareId)
    render(await open())
    expect(screen.getByRole('status')).toHaveTextContent("You've asked to edit this deck")
    expect(screen.queryByRole('button', { name: 'Send request' })).not.toBeInTheDocument()
  })

  it('sends owners and editors straight to the edit page', async () => {
    signIn('owner')
    await expect(open()).rejects.toThrow(`Redirected to /decks/${deck.id}`)

    await decks.requestEditAccess(db, 'helper', deck.shareId)
    await decks.respondToAccessRequest(db, 'owner', deck.id, 'helper', true)
    signIn('helper')
    await expect(open()).rejects.toThrow(`Redirected to /decks/${deck.id}`)
  })

  /** @see docs/deck-sharing.md § "Returning after sign-in" */
  it('sends someone signed out to sign in, and back here after', async () => {
    signInAs(null)
    await expect(open()).rejects.toThrow(
      `Redirected to /sign-in?next=${encodeURIComponent(`/d/${deck.shareId}/request`)}`,
    )
  })

  it("shows the not-found page for a deck that doesn't exist", async () => {
    await expect(open('nope')).rejects.toThrow(NotFoundPage)
  })
})
