/** @vitest-environment jsdom */
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  cards,
  deletePlan,
  drawn,
  drawPreview,
  keepPicks,
  keptPicks,
  picks,
  planOrder,
  preloadPreview,
  renderBuilder,
  resetPlanBuilder,
  router,
  savePlan,
  updatePlan,
} from '@/test/plan-builder'
import PlanBuilder from './PlanBuilder'

vi.mock('@/lib/actions/plans', () => import('@/test/plan-builder-mocks'))
vi.mock('@/lib/actions/decks', () => import('@/test/plan-builder-mocks'))
vi.mock('@/lib/actions/preferences', () => import('@/test/plan-builder-mocks'))
vi.mock('@/lib/og/client', () => import('@/test/plan-builder-mocks'))
vi.mock('next/navigation', () => import('@/test/plan-builder-mocks'))
vi.mock('next/link', () => import('@/test/plan-builder-mocks'))

beforeEach(resetPlanBuilder)
afterEach(() => vi.restoreAllMocks())

describe('PlanBuilder', () => {
  /** @see docs/plans.md § "Sharing a plan" */
  describe('saving the plan', () => {
    it('saves the plan when Save plan is pressed and opens it, ready to share, with no share dialog of its own', async () => {
      savePlan.mockResolvedValue({ ok: true, data: { planId: 'plan42' } })
      const share = vi.fn()
      Object.defineProperty(navigator, 'share', { value: share, configurable: true })
      const user = userEvent.setup({ delay: null })
      renderBuilder()

      await user.click(screen.getByRole('button', { name: 'Add to plan: Hike' }))
      await user.click(screen.getByRole('button', { name: 'Add to plan: Museum' }))
      await user.click(screen.getByRole('button', { name: 'Save plan' }))

      expect(savePlan).toHaveBeenCalledWith('share123', ['hike', 'museum'], [], drawn)
      await waitFor(() => expect(router.push).toHaveBeenCalledExactlyOnceWith('/p/plan42?share'))
      // Saving till the page changes, so it can't be pressed twice.
      expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
      // The plan's page shares it.
      expect(share).not.toHaveBeenCalled()
      expect(screen.queryByRole('button', { name: 'Copy link', hidden: true })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'Open your plan', hidden: true })).not.toBeInTheDocument()
    })

    /**
     * @see docs/plans.md § "Sharing a plan" - if saving fails, the builder stays put and shows why
     * @see docs/plans.md § "Picks are kept in the browser" - only forgotten once Save plan has saved them
     */
    it('shows why a plan could not be saved, and keeps the picks', async () => {
      savePlan.mockResolvedValue({ ok: false, error: 'Deck not found' })
      const user = userEvent.setup({ delay: null })
      renderBuilder()

      await user.click(screen.getByRole('button', { name: 'Add to plan: Hike' }))
      await user.click(screen.getByRole('button', { name: 'Save plan' }))
      expect(await screen.findByRole('alert')).toHaveTextContent('Deck not found')
      expect(router.push).not.toHaveBeenCalled()
      expect(keptPicks()).toEqual(picks(['hike']))
    })

    /** @see docs/plans.md § "Sharing a plan" - if saving fails, the builder stays put and shows why */
    it("says the plan couldn't be saved when the server can't be reached, and stays put", async () => {
      savePlan.mockRejectedValue(new Error('Failed to fetch'))
      const user = userEvent.setup({ delay: null })
      renderBuilder()

      await user.click(screen.getByRole('button', { name: 'Add to plan: Hike' }))
      await user.click(screen.getByRole('button', { name: 'Save plan' }))
      expect(await screen.findByRole('alert')).toHaveTextContent(
        "Couldn't save your plan. Check your connection and try again.",
      )
      expect(router.push).not.toHaveBeenCalled()
      expect(screen.getByRole('button', { name: 'Save plan' })).toBeEnabled()
    })
  })

  /** @see docs/share-previews.md § "When it's drawn" */
  describe("the plan's link preview", () => {
    it('is drawn from the picks, fanned out, and sent with the plan', async () => {
      savePlan.mockResolvedValue({ ok: true, data: { planId: 'plan42' } })
      const user = userEvent.setup({ delay: null })
      render(
        <PlanBuilder
          deckName="Test deck"
          shareId="share123"
          cards={[...cards, { id: 'gig', title: 'Gig', description: '', tags: [], date: 'Fri 3 Oct' }]}
          seed={1}
        />,
      )

      await user.click(screen.getByRole('button', { name: 'Add to plan: Hike' }))
      await user.click(screen.getByRole('button', { name: 'Add to plan: Gig' }))
      await user.click(screen.getByRole('button', { name: 'Save plan' }))

      expect(drawPreview).toHaveBeenCalledWith({
        title: 'Test deck',
        cards: [
          { id: 'hike', title: 'Hike' },
          { id: 'gig', title: 'Gig', date: 'Fri 3 Oct' },
        ],
        layout: 'fan',
      })
      expect(savePlan).toHaveBeenCalledWith('share123', ['hike', 'gig'], [], drawn)
    })

    it("saves the plan without one when it can't be drawn", async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      drawPreview.mockRejectedValue(new Error('Drawing the link preview took too long'))
      savePlan.mockResolvedValue({ ok: true, data: { planId: 'plan42' } })
      const user = userEvent.setup({ delay: null })
      renderBuilder()

      await user.click(screen.getByRole('button', { name: 'Add to plan: Hike' }))
      await user.click(screen.getByRole('button', { name: 'Save plan' }))

      expect(savePlan).toHaveBeenCalledWith('share123', ['hike'], [], undefined)
      await waitFor(() => expect(router.push).toHaveBeenCalledExactlyOnceWith('/p/plan42?share'))
    })

    it('starts loading what drawing needs once there is a pick', async () => {
      const user = userEvent.setup({ delay: null })
      renderBuilder()
      expect(preloadPreview).not.toHaveBeenCalled()
      await user.click(screen.getByRole('button', { name: 'Add to plan: Hike' }))
      expect(preloadPreview).toHaveBeenCalled()
    })
  })

  /** @see docs/plans.md § "Editing a plan" */
  describe('editing a saved plan', () => {
    const planPicks = 'build-a-date:picks:plan:plan42'

    function renderEditor() {
      return render(
        <PlanBuilder
          deckName="Test deck"
          shareId="share123"
          cards={cards}
          seed={1}
          plan={{ id: 'plan42', cardIds: ['hike', 'picnic'], groups: [] }}
        />,
      )
    }

    beforeEach(() => {
      updatePlan.mockResolvedValue({ ok: true, data: { planId: 'plan42' } })
    })

    it("starts with the plan's cards in the plan, in its order", () => {
      const { container } = renderEditor()
      expect(planOrder(container)).toEqual(['hike', 'picnic'])
      expect(screen.getByText('Editing a plan')).toBeInTheDocument()
    })

    it('saves over the same plan when Update Plan is pressed, and opens it without the share dialog', async () => {
      const user = userEvent.setup({ delay: null })
      renderEditor()

      await user.click(screen.getByRole('button', { name: 'Add to plan: Museum' }))
      expect(screen.queryByRole('button', { name: 'Save plan' })).not.toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Update Plan' }))
      expect(updatePlan).toHaveBeenCalledWith('plan42', ['hike', 'picnic', 'museum'], [], drawn)
      expect(savePlan).not.toHaveBeenCalled()
      await waitFor(() => expect(router.push).toHaveBeenCalledExactlyOnceWith('/p/plan42'))
    })

    it('goes to the plan without saving when nothing has changed', async () => {
      const user = userEvent.setup({ delay: null })
      renderEditor()

      await user.click(screen.getByRole('button', { name: 'Update Plan' }))
      expect(router.push).toHaveBeenCalledExactlyOnceWith('/p/plan42')
      expect(updatePlan).not.toHaveBeenCalled()
    })

    it('shows why the plan could not be saved', async () => {
      updatePlan.mockResolvedValue({ ok: false, error: 'Plan not found' })
      const user = userEvent.setup({ delay: null })
      renderEditor()

      await user.click(screen.getByRole('button', { name: 'Discard: Hike' }))
      await user.click(screen.getByRole('button', { name: 'Update Plan' }))
      expect(await screen.findByRole('alert')).toHaveTextContent('Plan not found')
    })

    /** @see docs/plans.md § "Picks are kept in the browser" - one set per plan being edited */
    it("keeps unsaved changes for that plan, apart from the deck's own picks", async () => {
      keepPicks(['museum'])
      const user = userEvent.setup({ delay: null })
      const { container } = renderEditor()
      expect(planOrder(container)).toEqual(['hike', 'picnic'])
      expect(keptPicks(planPicks)).toBeNull()

      await user.click(screen.getByRole('button', { name: 'Discard: Hike' }))
      expect(keptPicks(planPicks)).toEqual(picks(['picnic']))
      expect(keptPicks()).toEqual(picks(['museum']))
    })

    /** @see docs/plans.md § "Picks are kept in the browser" - changes to a saved plan survive a reload, not the tab */
    it('keeps unsaved changes to the plan for this tab only', async () => {
      const user = userEvent.setup({ delay: null })
      renderEditor()

      await user.click(screen.getByRole('button', { name: 'Discard: Hike' }))
      expect(JSON.parse(sessionStorage.getItem(planPicks) ?? 'null')).toEqual(picks(['picnic']))
      expect(localStorage.getItem(planPicks)).toBeNull()
    })

    /** @see docs/plans.md § "Picks are kept in the browser" - one set per plan being edited */
    it('picks up unsaved changes to the plan straight away', () => {
      keepPicks(['museum', 'hike'], planPicks)
      const { container } = renderEditor()
      expect(planOrder(container)).toEqual(['museum', 'hike'])
    })

    /** @see docs/plans.md § "Picks are kept in the browser" - forgotten once saved */
    it('forgets the changes once they are saved', async () => {
      const user = userEvent.setup({ delay: null })
      renderEditor()

      await user.click(screen.getByRole('button', { name: 'Discard: Hike' }))
      expect(keptPicks(planPicks)).toEqual(picks(['picnic']))
      await user.click(screen.getByRole('button', { name: 'Update Plan' }))
      await waitFor(() => expect(keptPicks(planPicks)).toBeNull())
    })

    /** @see docs/plans.md § "Picks are kept in the browser" - nothing kept for the plan as it was last saved */
    it('forgets the changes once the plan is put back as it was saved', async () => {
      const user = userEvent.setup({ delay: null })
      const { container } = renderEditor()

      await user.click(screen.getByRole('button', { name: 'Discard: Hike' }))
      await user.click(screen.getByRole('button', { name: 'Add to plan: Hike' }))
      expect(keptPicks(planPicks)).toEqual(picks(['picnic', 'hike']))

      act(() => screen.getByRole('button', { name: 'Move Hike' }).focus())
      await user.keyboard('{ArrowUp}')
      expect(planOrder(container)).toEqual(['hike', 'picnic'])
      expect(keptPicks(planPicks)).toBeNull()
    })

    /**
     * @see docs/plans.md § "Picks are kept in the browser" - an emptied plan that's being edited is kept as empty
     * @see docs/plans.md § "Editing a plan" - the buttons stay showing when every card has been taken out
     */
    it('keeps an emptied plan as empty, rather than going back to the saved one', async () => {
      const user = userEvent.setup({ delay: null })
      renderEditor()

      await user.click(screen.getByRole('button', { name: 'Discard: Hike' }))
      await user.click(screen.getByRole('button', { name: 'Discard: Picnic' }))
      expect(keptPicks(planPicks)).toEqual(picks([]))
      // Nothing to save, but still a way out.
      expect(screen.getByRole('button', { name: 'Update Plan' })).toBeDisabled()
      expect(screen.getByRole('link', { name: 'Cancel' })).toBeInTheDocument()
    })

    it('goes back to the plan on Cancel, dropping the unsaved changes', async () => {
      const user = userEvent.setup({ delay: null })
      renderEditor()

      await user.click(screen.getByRole('button', { name: 'Discard: Hike' }))
      expect(keptPicks(planPicks)).toEqual(picks(['picnic']))
      const cancel = screen.getByRole('link', { name: 'Cancel' })
      expect(cancel).toHaveAttribute('href', '/p/plan42')
      await user.click(cancel)
      expect(keptPicks(planPicks)).toBeNull()
      expect(updatePlan).not.toHaveBeenCalled()
    })

    /** @see docs/plans.md § "Deleting a plan" */
    describe('deleting it', () => {
      it('has Delete plan in place of Clear plan', () => {
        renderEditor()
        expect(screen.getByRole('button', { name: 'Delete plan' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Clear plan' })).not.toBeInTheDocument()
      })

      it('deletes it once confirmed, and goes back to the deck', async () => {
        vi.spyOn(window, 'confirm').mockReturnValue(true)
        deletePlan.mockResolvedValue({ ok: true, data: undefined })
        keepPicks(['museum'], planPicks)
        const user = userEvent.setup({ delay: null })
        renderEditor()

        await user.click(screen.getByRole('button', { name: 'Delete plan' }))
        expect(window.confirm).toHaveBeenCalled()
        expect(deletePlan).toHaveBeenCalledWith('plan42')
        await waitFor(() => expect(router.push).toHaveBeenCalledWith('/d/share123'))
        expect(keptPicks(planPicks)).toBeNull()
      })

      it('does nothing unless confirmed', async () => {
        vi.spyOn(window, 'confirm').mockReturnValue(false)
        const user = userEvent.setup({ delay: null })
        renderEditor()

        await user.click(screen.getByRole('button', { name: 'Delete plan' }))
        expect(deletePlan).not.toHaveBeenCalled()
        expect(router.push).not.toHaveBeenCalled()
      })

      it("says why it couldn't be deleted, and stays put", async () => {
        vi.spyOn(window, 'confirm').mockReturnValue(true)
        deletePlan.mockResolvedValue({ ok: false, error: 'Plan not found' })
        const user = userEvent.setup({ delay: null })
        renderEditor()

        await user.click(screen.getByRole('button', { name: 'Delete plan' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('Plan not found')
        expect(router.push).not.toHaveBeenCalled()
        expect(screen.getByRole('button', { name: 'Delete plan' })).toBeEnabled()
      })
    })
  })
})
