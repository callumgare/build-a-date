import { starterCards } from '@/data/starter-cards'
import { createTestDb, createUser } from '@/test/db'
import {
  createDeck,
  deleteCard,
  deleteDeck,
  getAccessState,
  getDeckCards,
  getEditableDeck,
  getOwnedDeck,
  getPlan,
  getSharedDeck,
  leaveDeck,
  listDeckAccess,
  listDecks,
  listPlans,
  listSharedDecks,
  NotFoundError,
  removeEditor,
  renameDeck,
  requestEditAccess,
  respondToAccessRequest,
  saveCard,
  savePlan,
} from './decks'

let db: ReturnType<typeof createTestDb>
let owner: string
let stranger: string

beforeEach(async () => {
  db = createTestDb()
  owner = await createUser(db, 'owner')
  stranger = await createUser(db, 'stranger')
})

describe('createDeck', () => {
  it('starts an empty deck with no cards', async () => {
    const deck = await createDeck(db, owner, { name: 'Empty', template: 'empty' })
    expect(await getDeckCards(db, deck.id)).toHaveLength(0)
    expect(deck.shareId).toMatch(/^[a-z0-9]{10}$/)
  })

  it('fills a suggestions deck with every starter card', async () => {
    const deck = await createDeck(db, owner, { name: 'Ideas', template: 'suggestions' })
    const cards = await getDeckCards(db, deck.id)
    expect(cards.map((card) => card.title)).toEqual(starterCards.map((card) => card.title))
  })
})

describe('owner checks', () => {
  it("won't show, rename or delete someone else's deck", async () => {
    const deck = await createDeck(db, owner, { name: 'Mine', template: 'empty' })
    await expect(getOwnedDeck(db, stranger, deck.id)).rejects.toThrow(NotFoundError)
    await expect(renameDeck(db, stranger, deck.id, 'Theirs')).rejects.toThrow(NotFoundError)
    await expect(deleteDeck(db, stranger, deck.id)).rejects.toThrow(NotFoundError)
    expect((await getOwnedDeck(db, owner, deck.id)).name).toBe('Mine')
  })

  it("won't add, edit or delete cards in someone else's deck", async () => {
    const deck = await createDeck(db, owner, { name: 'Mine', template: 'empty' })
    const card = await saveCard(db, owner, deck.id, null, { title: 'Picnic' })
    await expect(saveCard(db, stranger, deck.id, null, { title: 'Sneaky' })).rejects.toThrow(NotFoundError)
    await expect(saveCard(db, stranger, deck.id, card.id, { title: 'Sneaky' })).rejects.toThrow(NotFoundError)
    await expect(deleteCard(db, stranger, deck.id, card.id)).rejects.toThrow(NotFoundError)
    expect((await getDeckCards(db, deck.id)).map((row) => row.title)).toEqual(['Picnic'])
  })

  it("won't edit a card through a different deck's id", async () => {
    const mine = await createDeck(db, owner, { name: 'A', template: 'empty' })
    const other = await createDeck(db, owner, { name: 'B', template: 'empty' })
    const card = await saveCard(db, owner, mine.id, null, { title: 'Picnic' })
    await expect(saveCard(db, owner, other.id, card.id, { title: 'Moved' })).rejects.toThrow(NotFoundError)
  })
})

describe('saveCard', () => {
  it('adds cards at the end and updates them in place', async () => {
    const deck = await createDeck(db, owner, { name: 'Deck', template: 'empty' })
    const first = await saveCard(db, owner, deck.id, null, { title: 'First', tags: ['Outside'] })
    await saveCard(db, owner, deck.id, null, { title: 'Second' })
    await saveCard(db, owner, deck.id, first.id, { title: 'First, edited', tags: ['free'], date: 'Fridays' })

    const cards = await getDeckCards(db, deck.id)
    expect(cards.map((card) => [card.title, card.position])).toEqual([
      ['First, edited', 0],
      ['Second', 1],
    ])
    expect(cards[0].tags).toEqual(['free'])
    expect(cards[0].date).toBe('Fridays')
  })
})

describe('listDecks', () => {
  it("lists only the owner's decks, with card and plan counts", async () => {
    const deck = await createDeck(db, owner, { name: 'Deck', template: 'empty' })
    await createDeck(db, stranger, { name: 'Not mine', template: 'empty' })
    const card = await saveCard(db, owner, deck.id, null, { title: 'Picnic' })
    await savePlan(db, deck.shareId, [card.id])

    expect(await listDecks(db, owner)).toMatchObject([{ name: 'Deck', cards: 1, plans: 1 }])
  })
})

describe('plans', () => {
  it('keeps only cards from the shared deck, in order, without repeats', async () => {
    const deck = await createDeck(db, owner, { name: 'Deck', template: 'empty' })
    const other = await createDeck(db, stranger, { name: 'Other', template: 'empty' })
    const a = await saveCard(db, owner, deck.id, null, { title: 'A' })
    const b = await saveCard(db, owner, deck.id, null, { title: 'B' })
    const foreign = await saveCard(db, stranger, other.id, null, { title: 'Foreign' })

    const plan = await savePlan(db, deck.shareId, [b.id, foreign.id, a.id, b.id, 'made-up'])
    expect(plan.cardIds).toEqual([b.id, a.id])
    expect((await getPlan(db, plan.id)).cards.map((card) => card.title)).toEqual(['B', 'A'])
    expect(await listPlans(db, deck.id)).toHaveLength(1)
  })

  it('refuses a plan with no cards from the deck', async () => {
    const deck = await createDeck(db, owner, { name: 'Deck', template: 'empty' })
    await expect(savePlan(db, deck.shareId, ['made-up'])).rejects.toThrow(NotFoundError)
  })

  it('refuses an unknown share id', async () => {
    await expect(savePlan(db, 'nope', ['x'])).rejects.toThrow(NotFoundError)
    await expect(getSharedDeck(db, 'nope')).rejects.toThrow(NotFoundError)
  })

  it('drops cards deleted after the plan was made', async () => {
    const deck = await createDeck(db, owner, { name: 'Deck', template: 'empty' })
    const a = await saveCard(db, owner, deck.id, null, { title: 'A' })
    const b = await saveCard(db, owner, deck.id, null, { title: 'B' })
    const plan = await savePlan(db, deck.shareId, [a.id, b.id])
    await deleteCard(db, owner, deck.id, a.id)
    expect((await getPlan(db, plan.id)).cards.map((card) => card.title)).toEqual(['B'])
  })

  it('goes away with its deck', async () => {
    const deck = await createDeck(db, owner, { name: 'Deck', template: 'empty' })
    const card = await saveCard(db, owner, deck.id, null, { title: 'A' })
    const plan = await savePlan(db, deck.shareId, [card.id])
    await deleteDeck(db, owner, deck.id)
    await expect(getPlan(db, plan.id)).rejects.toThrow(NotFoundError)
  })
})

/** @see docs/deck-sharing.md § "Who can do what" */
describe('edit access', () => {
  async function sharedDeck() {
    return createDeck(db, owner, { name: 'Ours', template: 'empty' })
  }

  /** @see docs/deck-sharing.md § "Asking for edit access" - the email only goes out the first time */
  it('lets someone ask once, and tells the caller only the first time', async () => {
    const deck = await sharedDeck()
    const first = await requestEditAccess(db, stranger, deck.shareId)
    expect(first.created).toBe(true)
    expect(first.owner.email).toBe('owner@example.com')
    expect((await requestEditAccess(db, stranger, deck.shareId)).created).toBe(false)

    expect(await getAccessState(db, stranger, deck)).toBe('pending')
    expect(await listDeckAccess(db, owner, deck.id)).toMatchObject([{ userId: stranger, status: 'pending' }])
    expect((await listDecks(db, owner))[0].requests).toBe(1)
  })

  it("doesn't make a request for the owner's own deck", async () => {
    const deck = await sharedDeck()
    expect((await requestEditAccess(db, owner, deck.shareId)).created).toBe(false)
    expect(await getAccessState(db, owner, deck)).toBe('owner')
    expect(await listDeckAccess(db, owner, deck.id)).toEqual([])
  })

  it("won't let a pending requester edit, or see it as a shared deck", async () => {
    const deck = await sharedDeck()
    await requestEditAccess(db, stranger, deck.shareId)
    await expect(getEditableDeck(db, stranger, deck.id)).rejects.toThrow(NotFoundError)
    await expect(saveCard(db, stranger, deck.id, null, { title: 'Sneaky' })).rejects.toThrow(NotFoundError)
    expect(await listSharedDecks(db, stranger)).toEqual([])
  })

  it('lets an accepted editor change cards, but not rename, delete or manage access', async () => {
    const deck = await sharedDeck()
    await requestEditAccess(db, stranger, deck.shareId)
    await respondToAccessRequest(db, owner, deck.id, stranger, true)

    expect(await getAccessState(db, stranger, deck)).toBe('editor')
    expect((await getEditableDeck(db, stranger, deck.id)).role).toBe('editor')
    const card = await saveCard(db, stranger, deck.id, null, { title: 'Picnic' })
    await saveCard(db, stranger, deck.id, card.id, { title: 'Picnic, edited' })
    expect((await getDeckCards(db, deck.id)).map((row) => row.title)).toEqual(['Picnic, edited'])
    await deleteCard(db, stranger, deck.id, card.id)
    expect(await getDeckCards(db, deck.id)).toHaveLength(0)

    await expect(renameDeck(db, stranger, deck.id, 'Mine now')).rejects.toThrow(NotFoundError)
    await expect(deleteDeck(db, stranger, deck.id)).rejects.toThrow(NotFoundError)
    await expect(listDeckAccess(db, stranger, deck.id)).rejects.toThrow(NotFoundError)
    await expect(removeEditor(db, stranger, deck.id, stranger)).rejects.toThrow(NotFoundError)

    expect(await listSharedDecks(db, stranger)).toMatchObject([{ id: deck.id, name: 'Ours', ownerName: 'owner' }])
    expect(await listDecks(db, stranger)).toEqual([])
  })

  /** @see docs/deck-sharing.md § "Answering requests" */
  it('declining deletes the request, so they can ask again', async () => {
    const deck = await sharedDeck()
    await requestEditAccess(db, stranger, deck.shareId)
    await respondToAccessRequest(db, owner, deck.id, stranger, false)
    expect(await getAccessState(db, stranger, deck)).toBe('none')
    await expect(respondToAccessRequest(db, owner, deck.id, stranger, true)).rejects.toThrow(NotFoundError)
    expect((await requestEditAccess(db, stranger, deck.shareId)).created).toBe(true)
  })

  /** @see docs/deck-sharing.md § "Answering requests" */
  it("only the owner answers requests, and can't accept someone who never asked", async () => {
    const deck = await sharedDeck()
    await requestEditAccess(db, stranger, deck.shareId)
    await expect(respondToAccessRequest(db, stranger, deck.id, stranger, true)).rejects.toThrow(NotFoundError)
    const third = await createUser(db, 'third')
    await expect(respondToAccessRequest(db, owner, deck.id, third, true)).rejects.toThrow(NotFoundError)
  })

  /** @see docs/deck-sharing.md § "Removing and leaving" */
  it('removing or leaving takes editing away', async () => {
    const deck = await sharedDeck()
    const third = await createUser(db, 'third')
    for (const user of [stranger, third]) {
      await requestEditAccess(db, user, deck.shareId)
      await respondToAccessRequest(db, owner, deck.id, user, true)
    }

    await removeEditor(db, owner, deck.id, stranger)
    await leaveDeck(db, third, deck.id)
    await expect(getEditableDeck(db, stranger, deck.id)).rejects.toThrow(NotFoundError)
    await expect(getEditableDeck(db, third, deck.id)).rejects.toThrow(NotFoundError)
    expect(await listDeckAccess(db, owner, deck.id)).toEqual([])
  })

  /** @see docs/deck-sharing.md § "Removing and leaving" - deleting the deck deletes its access rows */
  it('goes when the deck does', async () => {
    const deck = await sharedDeck()
    await requestEditAccess(db, stranger, deck.shareId)
    await respondToAccessRequest(db, owner, deck.id, stranger, true)
    await deleteDeck(db, owner, deck.id)
    expect(await listSharedDecks(db, stranger)).toEqual([])
  })

  it("won't request access to a deck that doesn't exist", async () => {
    await expect(requestEditAccess(db, stranger, 'nope')).rejects.toThrow(NotFoundError)
  })
})
