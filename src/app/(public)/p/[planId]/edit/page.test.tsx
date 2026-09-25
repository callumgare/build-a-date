import type { ComponentProps, ReactElement } from 'react'
import type DeckBuilder from '@/components/DeckBuilder'
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
  const page = (await EditPlan(props(planId))) as ReactElement<ComponentProps<typeof DeckBuilder>>
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

  it('leaves out cards deleted since the plan was saved', async () => {
    const plan = await decks.savePlan(db, deck.shareId, [hike.id, picnic.id])
    await decks.deleteCard(db, 'owner', deck.id, hike.id)

    expect((await open(plan.id)).plan?.cardIds).toEqual([picnic.id])
  })

  /** @see docs/card-notes.md § "Editing a card" */
  it('lets the owner change the cards from there too', async () => {
    const plan = await decks.savePlan(db, deck.shareId, [hike.id])
    signInAs({ id: 'owner', name: 'owner', email: 'owner@example.com' })

    expect(await open(plan.id)).toMatchObject({
      deckId: deck.id,
      editHref: `/decks/${deck.id}`,
      access: 'owner',
      plans: [{ id: plan.id, cards: 1 }],
    })
  })

  it("shows the not-found page for a plan that doesn't exist", async () => {
    await expect(open('nope')).rejects.toThrow(NotFoundPage)
  })
})
