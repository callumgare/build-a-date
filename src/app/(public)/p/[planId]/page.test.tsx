/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react'
import * as decks from '@/lib/decks'
import { useTestDb } from '@/test/cloudflare'
import { createTestDb, createUser } from '@/test/db'
import { NotFoundPage } from '@/test/next'
import PlanPage, { generateMetadata } from './page'

vi.mock('next/navigation', () => import('@/test/next'))
vi.mock('@/db', () => import('@/test/cloudflare'))
vi.mock('next/link', () => ({ default: (props: object) => <a {...props} /> }))

let db: ReturnType<typeof createTestDb>
let deck: Awaited<ReturnType<typeof decks.createDeck>>

function props(planId: string) {
  return { params: Promise.resolve({ planId }) } as PageProps<'/p/[planId]'>
}

beforeEach(async () => {
  db = createTestDb()
  useTestDb(db)
  await createUser(db, 'owner')
  deck = await decks.createDeck(db, 'owner', { name: 'Weekend', template: 'empty' })
})

describe('the plan page', () => {
  it('shows the picked ideas in order, with a link to build your own', async () => {
    const picnic = await decks.saveCard(db, 'owner', deck.id, null, { title: 'Picnic' })
    const hike = await decks.saveCard(db, 'owner', deck.id, null, { title: 'Hike' })
    const plan = await decks.savePlan(db, deck.shareId, [hike.id, picnic.id])

    render(await PlanPage(props(plan.id)))
    const section = screen.getByRole('region', { name: 'The plan' })
    expect(section.textContent?.indexOf('Hike')).toBeLessThan(section.textContent?.indexOf('Picnic') ?? -1)
    expect(screen.getByRole('link', { name: 'Build your own plan' })).toHaveAttribute('href', `/d/${deck.shareId}`)
    expect(await generateMetadata(props(plan.id))).toMatchObject({ title: 'A plan from Weekend' })
  })

  /** @see docs/card-notes.md § "Rating and notes" - the notes aren't shown on plans */
  it("doesn't show the ideas' notes", async () => {
    const card = await decks.saveCard(db, 'owner', deck.id, null, { title: 'Picnic' })
    await decks.saveCardNotes(db, deck.shareId, card.id, { interest: 5, notes: 'Somewhere shady' })
    const plan = await decks.savePlan(db, deck.shareId, [card.id])

    render(await PlanPage(props(plan.id)))
    expect(screen.getByText('Picnic')).toBeInTheDocument()
    expect(screen.queryByText(/Somewhere shady/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Rated|Has notes/)).not.toBeInTheDocument()
  })

  it('says so when every idea in it has since been deleted', async () => {
    const card = await decks.saveCard(db, 'owner', deck.id, null, { title: 'Picnic' })
    const plan = await decks.savePlan(db, deck.shareId, [card.id])
    await decks.deleteCard(db, 'owner', deck.id, card.id)

    render(await PlanPage(props(plan.id)))
    expect(screen.getByText('The ideas in this plan have since been removed from the deck.')).toBeInTheDocument()
  })

  it("shows the not-found page for a plan that doesn't exist", async () => {
    await expect(PlanPage(props('nope'))).rejects.toThrow(NotFoundPage)
  })
})
