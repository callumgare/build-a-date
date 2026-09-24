import { resetEnv, useTestDb } from '@/test/cloudflare'
import { createTestDb, createUser } from '@/test/db'
import { NotFoundPage, RedirectError, revalidatePath } from '@/test/next'
import { signInAs } from '@/test/session'
import * as decks from '../decks'
import { devOutbox } from '../email'
import {
  createDeck,
  deleteCard,
  deleteDeck,
  leaveDeck,
  removeEditor,
  renameDeck,
  requestEditAccess,
  respondToAccessRequest,
  saveCard,
} from './decks'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => import('@/test/next'))
vi.mock('next/headers', () => import('@/test/next'))
vi.mock('next/cache', () => import('@/test/next'))
vi.mock('@opennextjs/cloudflare', () => import('@/test/cloudflare'))
vi.mock('@/db', () => import('@/test/cloudflare'))
vi.mock('@/lib/auth-config', () => import('@/test/session'))

let db: ReturnType<typeof createTestDb>

function signIn(id: string) {
  signInAs({ id, name: id, email: `${id}@example.com` })
}

beforeEach(async () => {
  vi.clearAllMocks()
  db = createTestDb()
  useTestDb(db)
  resetEnv()
  devOutbox.length = 0
  await createUser(db, 'owner')
  await createUser(db, 'helper')
  signIn('owner')
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('createDeck', () => {
  it('makes the deck and goes to it', async () => {
    await expect(createDeck({ name: ' Weekend ', template: 'empty' })).rejects.toThrow(RedirectError)
    const [deck] = await decks.listDecks(db, 'owner')
    expect(deck.name).toBe('Weekend')
    await expect(createDeck({ name: 'Again', template: 'empty' })).rejects.toThrow(/\/decks\/[\w-]+$/)
  })

  it('says what is wrong with the name', async () => {
    expect(await createDeck({ name: ' ', template: 'empty' })).toEqual({ ok: false, error: 'Give your deck a name' })
  })

  it('sends someone signed out to sign in', async () => {
    signInAs(null)
    await expect(createDeck({ name: 'Weekend', template: 'empty' })).rejects.toThrow('Redirected to /sign-in')
    expect(await decks.listDecks(db, 'owner')).toEqual([])
  })
})

describe('changing a deck', () => {
  let deckId: string

  beforeEach(async () => {
    deckId = (await decks.createDeck(db, 'owner', { name: 'Weekend', template: 'empty' })).id
  })

  it('renames it and refreshes its page', async () => {
    expect(await renameDeck(deckId, ' Sundays ')).toEqual({ ok: true, data: undefined })
    expect((await decks.getOwnedDeck(db, 'owner', deckId)).name).toBe('Sundays')
    expect(revalidatePath).toHaveBeenCalledWith(`/decks/${deckId}`)
  })

  it('turns a bad name or a deck that is not yours into a message', async () => {
    expect(await renameDeck(deckId, '')).toEqual({ ok: false, error: 'Give your deck a name' })
    signIn('helper')
    expect(await renameDeck(deckId, 'Mine')).toEqual({ ok: false, error: 'Deck not found' })
    expect(await deleteDeck(deckId)).toEqual({ ok: false, error: 'Deck not found' })
  })

  it('deletes it and goes back to the decks', async () => {
    await expect(deleteDeck(deckId)).rejects.toThrow('Redirected to /decks')
    expect(await decks.listDecks(db, 'owner')).toEqual([])
  })

  it('adds, edits and deletes cards', async () => {
    const added = await saveCard(deckId, null, { title: 'Picnic' })
    if (!added.ok) throw new Error(added.error)
    expect(await saveCard(deckId, added.data.id, { title: 'Picnic, edited' })).toEqual({
      ok: true,
      data: { id: added.data.id },
    })
    expect((await decks.getDeckCards(db, deckId)).map((card) => card.title)).toEqual(['Picnic, edited'])

    expect(await deleteCard(deckId, added.data.id)).toEqual({ ok: true, data: undefined })
    expect(await decks.getDeckCards(db, deckId)).toEqual([])
    expect(revalidatePath).toHaveBeenCalledWith(`/decks/${deckId}`)
  })

  it('turns a card without a title into a message', async () => {
    expect(await saveCard(deckId, null, { title: '' })).toEqual({ ok: false, error: 'Give the idea a title' })
  })
})

/** @see docs/deck-sharing.md § "Asking for edit access" */
describe('requestEditAccess', () => {
  let deck: Awaited<ReturnType<typeof decks.createDeck>>

  beforeEach(async () => {
    deck = await decks.createDeck(db, 'owner', { name: 'Weekend', template: 'empty' })
    signIn('helper')
  })

  it('saves the request, emails the owner a link to the deck, and goes back to the request page', async () => {
    await expect(requestEditAccess(deck.shareId)).rejects.toThrow(`Redirected to /d/${deck.shareId}/request`)

    expect(await decks.getAccessState(db, 'helper', deck)).toBe('pending')
    expect(devOutbox).toHaveLength(1)
    expect(devOutbox[0].to).toBe('owner@example.com')
    expect(devOutbox[0].subject).toBe('helper wants to help edit Weekend')
    expect(devOutbox[0].text).toContain(`http://localhost:3000/decks/${deck.id}`)
  })

  /** @see docs/deck-sharing.md § "Asking for edit access" - the email only goes out the first time */
  it('only emails the owner the first time', async () => {
    await expect(requestEditAccess(deck.shareId)).rejects.toThrow(RedirectError)
    await expect(requestEditAccess(deck.shareId)).rejects.toThrow(RedirectError)
    expect(devOutbox).toHaveLength(1)
  })

  it("doesn't email the owner about their own deck", async () => {
    signIn('owner')
    await expect(requestEditAccess(deck.shareId)).rejects.toThrow(RedirectError)
    expect(devOutbox).toEqual([])
  })

  /** @see docs/deck-sharing.md § "Asking for edit access" - if the email fails, the request is still saved */
  it('still saves the request when the email fails, logging the error rather than showing it', async () => {
    // Production with no Resend key, so sending throws.
    resetEnv({ BETTER_AUTH_URL: 'https://build-a-date.example' })

    await expect(requestEditAccess(deck.shareId)).rejects.toThrow(`Redirected to /d/${deck.shareId}/request`)
    expect(await decks.getAccessState(db, 'helper', deck)).toBe('pending')
    expect(console.error).toHaveBeenCalledWith(
      "Couldn't email the owner about an edit request",
      expect.objectContaining({ message: 'RESEND_API_KEY is not set' }),
    )
  })

  it("shows the not-found page for a deck that doesn't exist", async () => {
    await expect(requestEditAccess('nope')).rejects.toThrow(NotFoundPage)
    await expect(requestEditAccess('x'.repeat(65))).rejects.toThrow(NotFoundPage)
  })

  /** @see docs/deck-sharing.md § "Returning after sign-in" */
  it('sends someone signed out to sign in, and back to the request page after', async () => {
    signInAs(null)
    await expect(requestEditAccess(deck.shareId)).rejects.toThrow(
      `Redirected to /sign-in?next=${encodeURIComponent(`/d/${deck.shareId}/request`)}`,
    )
    expect(devOutbox).toEqual([])
  })
})

describe('answering and removing editors', () => {
  let deck: Awaited<ReturnType<typeof decks.createDeck>>

  beforeEach(async () => {
    deck = await decks.createDeck(db, 'owner', { name: 'Weekend', template: 'empty' })
    await decks.requestEditAccess(db, 'helper', deck.shareId)
  })

  it('lets the owner accept a request, then remove the editor', async () => {
    expect(await respondToAccessRequest(deck.id, 'helper', true)).toEqual({ ok: true, data: undefined })
    expect(await decks.getAccessState(db, 'helper', deck)).toBe('editor')

    expect(await removeEditor(deck.id, 'helper')).toEqual({ ok: true, data: undefined })
    expect(await decks.getAccessState(db, 'helper', deck)).toBe('none')
    expect(revalidatePath).toHaveBeenCalledWith(`/decks/${deck.id}`)
  })

  it('turns an answered request, or someone else answering, into a message', async () => {
    await respondToAccessRequest(deck.id, 'helper', false)
    expect(await respondToAccessRequest(deck.id, 'helper', true)).toEqual({
      ok: false,
      error: 'That request has already been answered',
    })
    signIn('helper')
    expect(await removeEditor(deck.id, 'helper')).toEqual({ ok: false, error: 'Deck not found' })
  })

  it('lets an editor leave, going back to the decks', async () => {
    await decks.respondToAccessRequest(db, 'owner', deck.id, 'helper', true)
    signIn('helper')
    await expect(leaveDeck(deck.id)).rejects.toThrow('Redirected to /decks')
    expect(await decks.getAccessState(db, 'helper', deck)).toBe('none')
  })
})
