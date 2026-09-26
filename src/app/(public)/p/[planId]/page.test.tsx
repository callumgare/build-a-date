/** @vitest-environment jsdom */
import { render, screen, within } from '@testing-library/react'
import * as decks from '@/lib/decks'
import { useTestDb } from '@/test/cloudflare'
import { createTestDb, createUser } from '@/test/db'
import { NotFoundPage } from '@/test/next'
import { signInAs } from '@/test/session'
import PlanPage, { generateMetadata } from './page'

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

function props(planId: string, searchParams: Record<string, string> = {}) {
  return {
    params: Promise.resolve({ planId }),
    searchParams: Promise.resolve(searchParams),
  } as PageProps<'/p/[planId]'>
}

beforeEach(async () => {
  db = createTestDb()
  useTestDb(db)
  signInAs(null)
  await createUser(db, 'owner')
  deck = await decks.createDeck(db, 'owner', { name: 'Weekend', template: 'empty' })
})

describe('the plan page', () => {
  it('shows the picked ideas in order, with links to edit it and create a new plan', async () => {
    const picnic = await decks.saveCard(db, 'owner', deck.id, null, { title: 'Picnic' })
    const hike = await decks.saveCard(db, 'owner', deck.id, null, { title: 'Hike' })
    const plan = await decks.savePlan(db, deck.shareId, [hike.id, picnic.id])

    render(await PlanPage(props(plan.id)))
    const section = screen.getByRole('region', { name: 'The plan' })
    expect(section.textContent?.indexOf('Hike')).toBeLessThan(section.textContent?.indexOf('Picnic') ?? -1)
    expect(screen.getByRole('link', { name: 'Create new plan' })).toHaveAttribute('href', `/d/${deck.shareId}`)
    expect(screen.queryByRole('link', { name: /Make your own deck/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Edit plan' })).toHaveAttribute('href', `/p/${plan.id}/edit`)
    expect(await generateMetadata(props(plan.id))).toMatchObject({ title: 'A plan from Weekend' })
  })

  /** @see docs/card-notes.md § "Rating and notes on the card" */
  it("jots each idea's rating and notes in its corner, without the notes themselves", async () => {
    const card = await decks.saveCard(db, 'owner', deck.id, null, { title: 'Picnic' })
    await decks.saveCardNotes(db, deck.shareId, card.id, { interest: 5, notes: 'Somewhere shady' })
    const plan = await decks.savePlan(db, deck.shareId, [card.id])

    render(await PlanPage(props(plan.id)))
    expect(screen.getByText('Rated 5 out of 5. Has notes.')).toBeInTheDocument()
    expect(screen.queryByText(/Somewhere shady/)).not.toBeInTheDocument()
  })

  /** @see docs/card-notes.md § "Card actions" - on a plan, only Notes */
  it('offers Notes on each idea, but no Discard', async () => {
    const card = await decks.saveCard(db, 'owner', deck.id, null, { title: 'Picnic' })
    const plan = await decks.savePlan(db, deck.shareId, [card.id])

    render(await PlanPage(props(plan.id)))
    const section = screen.getByRole('region', { name: 'The plan' })
    expect(within(section).getByRole('button', { name: 'Notes on Picnic' })).toBeInTheDocument()
    expect(within(section).queryByRole('button', { name: /^Discard/ })).not.toBeInTheDocument()
  })

  /** @see docs/card-notes.md § "Editing a card" */
  describe('the edit button', () => {
    let planId: string

    beforeEach(async () => {
      const card = await decks.saveCard(db, 'owner', deck.id, null, { title: 'Picnic' })
      planId = (await decks.savePlan(db, deck.shareId, [card.id])).id
      for (const id of ['helper', 'stranger']) await createUser(db, id)
      await decks.requestEditAccess(db, 'helper', deck.shareId)
      await decks.respondToAccessRequest(db, 'owner', deck.id, 'helper', true)
    })

    it.each(['owner', 'helper'])('is on each idea for the %s', async (id) => {
      signInAs({ id, name: id, email: `${id}@example.com` })
      render(await PlanPage(props(planId)))
      expect(screen.getByRole('button', { name: 'Edit Picnic' })).toBeInTheDocument()
    })

    it("isn't there for anyone else", async () => {
      render(await PlanPage(props(planId)))
      expect(screen.queryByRole('button', { name: 'Edit Picnic' })).not.toBeInTheDocument()

      signInAs({ id: 'stranger', name: 'stranger', email: 'stranger@example.com' })
      render(await PlanPage(props(planId)))
      expect(screen.queryByRole('button', { name: 'Edit Picnic' })).not.toBeInTheDocument()
    })
  })

  /** @see docs/plans.md § "Editing a plan" - coming back to the plan drops unsaved changes */
  it('forgets changes to the plan that were never saved', async () => {
    const card = await decks.saveCard(db, 'owner', deck.id, null, { title: 'Picnic' })
    const plan = await decks.savePlan(db, deck.shareId, [card.id])
    sessionStorage.setItem(`build-a-date:picks:plan:${plan.id}`, JSON.stringify([]))
    localStorage.setItem(`build-a-date:picks:deck:${deck.shareId}`, JSON.stringify([card.id]))

    render(await PlanPage(props(plan.id)))
    expect(sessionStorage.getItem(`build-a-date:picks:plan:${plan.id}`)).toBeNull()
    // Picks for a new plan from the deck are left alone.
    expect(localStorage.getItem(`build-a-date:picks:deck:${deck.shareId}`)).not.toBeNull()
  })

  /** @see docs/plans.md § "Sharing a plan" */
  it('opens the share dialog when it comes straight from Save plan, and not otherwise', async () => {
    const card = await decks.saveCard(db, 'owner', deck.id, null, { title: 'Picnic' })
    const plan = await decks.savePlan(db, deck.shareId, [card.id])

    const { unmount } = render(await PlanPage(props(plan.id)))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    unmount()

    render(await PlanPage(props(plan.id, { share: '' })))
    expect(screen.getByRole('dialog')).toHaveTextContent('Share this date plan')
  })

  /** @see docs/plans.md § "Groups" */
  it('shows each group on a row of its own, with its title and notes', async () => {
    const picnic = await decks.saveCard(db, 'owner', deck.id, null, { title: 'Picnic' })
    const hike = await decks.saveCard(db, 'owner', deck.id, null, { title: 'Hike' })
    const plan = await decks.savePlan(
      db,
      deck.shareId,
      [picnic.id],
      [{ id: 'g', title: 'Morning', notes: 'Start early\nBring water', cardIds: [hike.id] }],
    )

    render(await PlanPage(props(plan.id)))
    const group = screen.getByRole('region', { name: 'Morning' })
    expect(within(group).getByRole('heading', { name: 'Morning' })).toBeInTheDocument()
    expect(within(group).getByText(/Start early/)).toHaveTextContent('Start early Bring water')
    expect(within(group).getByRole('button', { name: 'Notes on Hike' })).toBeInTheDocument()
    expect(within(group).queryByRole('button', { name: 'Notes on Picnic' })).not.toBeInTheDocument()
  })

  it('shows a plan whose ideas are all in groups', async () => {
    const hike = await decks.saveCard(db, 'owner', deck.id, null, { title: 'Hike' })
    const plan = await decks.savePlan(
      db,
      deck.shareId,
      [],
      [{ id: 'g', title: 'Morning', notes: '', cardIds: [hike.id] }],
    )

    render(await PlanPage(props(plan.id)))
    expect(screen.getByRole('button', { name: 'Notes on Hike' })).toBeInTheDocument()
    expect(screen.queryByText(/have since been removed/)).not.toBeInTheDocument()
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
