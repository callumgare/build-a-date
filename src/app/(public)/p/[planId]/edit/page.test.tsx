import type { ComponentProps, ReactElement } from 'react'
import type PlanBuilder from '@/components/PlanBuilder'
import * as decks from '@/lib/decks'
import { useTestDb } from '@/test/cloudflare'
import { createTestDb, createUser } from '@/test/db'
import { NotFoundPage } from '@/test/next'
import { signInAs } from '@/test/session'
import EditPlan, { generateMetadata } from './page'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => import('@/test/next'))
vi.mock('next/headers', () => import('@/test/next'))
vi.mock('next/server', () => import('@/test/next'))
vi.mock('@opennextjs/cloudflare', () => import('@/test/cloudflare'))
vi.mock('@/db', () => import('@/test/cloudflare'))
vi.mock('@/lib/auth-config', () => import('@/test/session'))

let db: ReturnType<typeof createTestDb>
let deck: Awaited<ReturnType<typeof decks.createDeck>>
let picnic: Awaited<ReturnType<typeof decks.saveCard>>
let hike: Awaited<ReturnType<typeof decks.saveCard>>

function props(planId: string) {
  return { params: Promise.resolve({ planId }) } as PageProps<'/p/[planId]/edit'>
}

async function open(planId: string) {
  const page = (await EditPlan(props(planId))) as ReactElement<ComponentProps<typeof PlanBuilder>>
  return page.props
}

beforeEach(async () => {
  db = createTestDb()
  useTestDb(db)
  signInAs(null)
  await createUser(db, 'owner')
  deck = await decks.createDeck(db, 'owner', { name: 'Weekend', template: 'empty' })
  picnic = await decks.saveCard(db, 'owner', deck.id, null, { title: 'Picnic' })
  hike = await decks.saveCard(db, 'owner', deck.id, null, { title: 'Hike' })
})

/** @see docs/plans.md § "Editing a plan" */
describe('the edit plan page', () => {
  it("hands anyone the builder with the whole deck, starting from the plan's cards", async () => {
    const plan = await decks.savePlan(db, deck.shareId, [hike.id, picnic.id])

    const builder = await open(plan.id)
    expect(builder).toMatchObject({
      deckName: 'Weekend',
      shareId: deck.shareId,
      plan: { id: plan.id, cardIds: [hike.id, picnic.id] },
      editHref: undefined,
      deckId: undefined,
      plans: undefined,
    })
    expect(builder.cards.map((card) => card.title).sort()).toEqual(['Hike', 'Picnic'])
    expect(await generateMetadata(props(plan.id))).toMatchObject({ title: 'Edit a plan from Weekend' })
  })

  /** @see docs/share-previews.md § "The page's metadata" - the edit pages have no preview picture */
  it('has no link preview of its own', async () => {
    const plan = await decks.savePlan(db, deck.shareId, [hike.id])
    expect((await generateMetadata(props(plan.id))).openGraph).toBeUndefined()
  })

  /** @see docs/deck-filters.md § "Not in plan" - the planned ideas go to anyone, the plan being edited among them */
  it("hands the ideas the deck's saved plans have used to anyone", async () => {
    await decks.savePlan(db, deck.shareId, [picnic.id])
    const plan = await decks.savePlan(db, deck.shareId, [hike.id])

    expect((await open(plan.id)).plannedCardIds).toEqual([hike.id, picnic.id].sort())
  })

  it('leaves out cards deleted since the plan was saved', async () => {
    const plan = await decks.savePlan(db, deck.shareId, [hike.id, picnic.id])
    await decks.deleteCard(db, 'owner', deck.id, hike.id)

    expect((await open(plan.id)).plan?.cardIds).toEqual([picnic.id])
  })

  /** @see docs/plans.md § "Groups" */
  it("starts from the plan's groups too, without cards deleted since", async () => {
    const plan = await decks.savePlan(
      db,
      deck.shareId,
      [],
      [{ id: 'g', title: 'Out', notes: 'Sunscreen', cardIds: [hike.id, picnic.id] }],
    )
    await decks.deleteCard(db, 'owner', deck.id, hike.id)

    expect((await open(plan.id)).plan).toEqual({
      id: plan.id,
      cardIds: [],
      groups: [{ id: 'g', title: 'Out', notes: 'Sunscreen', cardIds: [picnic.id] }],
    })
  })

  /**
   * @see docs/card-notes.md § "Editing a card"
   * @see docs/deck-sharing.md § "Who can do what" - editors can do what the owner can
   */
  it.each(['owner', 'editor'] as const)('lets the %s change the cards from there too', async (who) => {
    const plan = await decks.savePlan(db, deck.shareId, [hike.id])
    if (who === 'editor') {
      await createUser(db, 'helper')
      await decks.requestEditAccess(db, 'helper', deck.shareId)
      await decks.respondToAccessRequest(db, 'owner', deck.id, 'helper', true)
    }
    const id = who === 'owner' ? 'owner' : 'helper'
    signInAs({ id, name: id, email: `${id}@example.com` })

    expect(await open(plan.id)).toMatchObject({
      deckId: deck.id,
      editHref: `/decks/${deck.id}`,
      access: who,
      plans: [{ id: plan.id, cards: 1 }],
    })
  })

  it("shows the not-found page for a plan that doesn't exist", async () => {
    await expect(open('nope')).rejects.toThrow(NotFoundPage)
  })
})
