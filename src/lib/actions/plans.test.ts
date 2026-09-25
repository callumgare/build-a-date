import { useTestDb } from '@/test/cloudflare'
import { createTestDb, createUser } from '@/test/db'
import { revalidatePath } from '@/test/next'
import * as decks from '../decks'
import { deletePlan, saveCardNotes, savePlan, updatePlan } from './plans'

vi.mock('@/db', () => import('@/test/cloudflare'))
vi.mock('next/cache', () => import('@/test/next'))

let db: ReturnType<typeof createTestDb>
let deck: Awaited<ReturnType<typeof decks.createDeck>>
let cardId: string

beforeEach(async () => {
  db = createTestDb()
  useTestDb(db)
  await createUser(db, 'owner')
  deck = await decks.createDeck(db, 'owner', { name: 'Weekend', template: 'empty' })
  cardId = (await decks.saveCard(db, 'owner', deck.id, null, { title: 'Picnic' })).id
})

describe('savePlan', () => {
  it('saves the plan and gives back its id', async () => {
    const result = await savePlan(deck.shareId, [cardId])
    if (!result.ok) throw new Error(result.error)
    expect((await decks.getPlan(db, result.data.planId)).cards.map((card) => card.title)).toEqual(['Picnic'])
  })

  it("refreshes the pages that list the deck's plans", async () => {
    vi.mocked(revalidatePath).mockClear()
    await savePlan(deck.shareId, [cardId])
    expect(revalidatePath).toHaveBeenCalledWith('/decks/[deckId]', 'page')
    expect(revalidatePath).toHaveBeenCalledWith('/d/[shareId]', 'page')
  })

  it('turns an empty plan, an unknown deck or cards from elsewhere into a message', async () => {
    expect(await savePlan(deck.shareId, [])).toMatchObject({ ok: false })
    expect(await savePlan('nope', [cardId])).toEqual({ ok: false, error: 'Deck not found' })
    expect(await savePlan(deck.shareId, ['made-up'])).toEqual({
      ok: false,
      error: 'None of those cards are in this deck',
    })
  })
})

/** @see docs/plans.md § "Who can edit a plan" */
describe('updatePlan', () => {
  it('saves over the plan, for anyone, and gives back the same id', async () => {
    const saved = await savePlan(deck.shareId, [cardId])
    if (!saved.ok) throw new Error(saved.error)
    const hike = await decks.saveCard(db, 'owner', deck.id, null, { title: 'Hike' })

    expect(await updatePlan(saved.data.planId, [hike.id, cardId])).toEqual({
      ok: true,
      data: { planId: saved.data.planId },
    })
    expect((await decks.getPlan(db, saved.data.planId)).cards.map((card) => card.title)).toEqual(['Hike', 'Picnic'])
  })

  it('turns an empty plan or an unknown plan into a message', async () => {
    const saved = await savePlan(deck.shareId, [cardId])
    if (!saved.ok) throw new Error(saved.error)
    expect(await updatePlan(saved.data.planId, [])).toMatchObject({ ok: false })
    expect(await updatePlan('nope', [cardId])).toEqual({ ok: false, error: 'Plan not found' })
  })
})

/** @see docs/plans.md § "Deleting a plan" */
describe('deletePlan', () => {
  it('deletes the plan, for anyone, and refreshes the plan lists', async () => {
    const saved = await savePlan(deck.shareId, [cardId])
    if (!saved.ok) throw new Error(saved.error)
    vi.mocked(revalidatePath).mockClear()

    expect(await deletePlan(saved.data.planId)).toEqual({ ok: true, data: undefined })
    await expect(decks.getPlan(db, saved.data.planId)).rejects.toThrow('Plan not found')
    expect(revalidatePath).toHaveBeenCalledWith('/decks/[deckId]', 'page')
  })

  it('turns an unknown plan into a message', async () => {
    expect(await deletePlan('nope')).toEqual({ ok: false, error: 'Plan not found' })
  })
})

/** @see docs/card-notes.md § "Who can change them" */
describe('saveCardNotes', () => {
  it('saves the rating and trimmed notes', async () => {
    expect(await saveCardNotes(deck.shareId, cardId, { interest: 3, notes: ' Shady spot ' })).toEqual({
      ok: true,
      data: undefined,
    })
    expect((await decks.getSharedDeck(db, deck.shareId)).cards[0]).toMatchObject({ interest: 3, notes: 'Shady spot' })
  })

  /** @see docs/card-notes.md § "Rating and notes" - 1–5 stars, notes up to 2000 characters */
  it('turns a bad rating, over-long notes or an unknown card into a message', async () => {
    expect(await saveCardNotes(deck.shareId, cardId, { interest: 6, notes: '' })).toMatchObject({ ok: false })
    expect(await saveCardNotes(deck.shareId, cardId, { interest: null, notes: 'x'.repeat(2001) })).toEqual({
      ok: false,
      error: 'Notes can be up to 2000 characters',
    })
    expect(await saveCardNotes(deck.shareId, 'made-up', { interest: 1, notes: '' })).toEqual({
      ok: false,
      error: 'Card not found',
    })
    expect((await decks.getSharedDeck(db, deck.shareId)).cards[0].interest).toBeUndefined()
  })
})
