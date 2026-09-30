/** @vitest-environment jsdom */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mediaMatching } from '@/test/media'
import {
  cards,
  deckPicks,
  drawn,
  keepPicks,
  keptPicks,
  picks,
  planOrder,
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
  it('shows the deck name and every card', () => {
    renderBuilder()
    expect(screen.getByRole('heading', { name: 'Test deck' })).toBeInTheDocument()
    for (const card of cards)
      expect(screen.getByRole('button', { name: `Add to plan: ${card.title}` })).toBeInTheDocument()
  })

  /** @see docs/card-notes.md § "Card actions" - plan cards have Discard and Notes */
  it('moves a picked card into the plan and back out', async () => {
    const user = userEvent.setup({ delay: null })
    renderBuilder()

    await user.click(screen.getByRole('button', { name: 'Add to plan: Picnic' }))
    expect(screen.getByRole('button', { name: 'Discard: Picnic' })).toBeInTheDocument()
    expect(keptPicks()).toEqual(picks(['picnic']))

    await user.click(screen.getByRole('button', { name: 'Discard: Picnic' }))
    expect(await screen.findByRole('button', { name: 'Add to plan: Picnic' })).toBeInTheDocument()
  })

  /** @see docs/plans.md § "Picks are kept in the browser" */
  describe('keeping the picks', () => {
    it('puts the picks kept for the deck straight into the plan', () => {
      keepPicks(['museum', 'not-a-card', 'museum'])
      renderBuilder()
      // Already there by the time the render returns, not added afterwards.
      expect(screen.getByRole('button', { name: 'Discard: Museum' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Add to plan: Museum' })).not.toBeInTheDocument()
      expect(screen.getAllByRole('button', { name: /^Discard/ })).toHaveLength(1)
    })

    it("doesn't put the picks in the URL", async () => {
      const user = userEvent.setup({ delay: null })
      renderBuilder()
      await user.click(screen.getByRole('button', { name: 'Add to plan: Picnic' }))
      expect(window.location.href).not.toContain('#')
      expect(window.location.search).toBe('')
    })

    it('forgets them once Save plan has saved them', async () => {
      savePlan.mockResolvedValue({ ok: true, data: { planId: 'plan42' } })
      const user = userEvent.setup({ delay: null })
      renderBuilder()

      await user.click(screen.getByRole('button', { name: 'Add to plan: Hike' }))
      expect(keptPicks()).toEqual(picks(['hike']))
      await user.click(screen.getByRole('button', { name: 'Save plan' }))
      await waitFor(() => expect(router.push).toHaveBeenCalled())
      expect(keptPicks()).toBeNull()
    })

    /** @see docs/plans.md § "Picks are kept in the browser" - changing the plan again keeps it again */
    it('keeps them again once the plan changes after Save plan', async () => {
      savePlan.mockResolvedValue({ ok: true, data: { planId: 'plan42' } })
      const user = userEvent.setup({ delay: null })
      renderBuilder()

      await user.click(screen.getByRole('button', { name: 'Add to plan: Hike' }))
      await user.click(screen.getByRole('button', { name: 'Save plan' }))
      await waitFor(() => expect(router.push).toHaveBeenCalled())
      expect(keptPicks()).toBeNull()

      await user.click(screen.getByRole('button', { name: 'Add to plan: Museum' }))
      expect(keptPicks()).toEqual(picks(['hike', 'museum']))
    })

    it('keeps a separate set for each deck', () => {
      keepPicks(['museum'], 'build-a-date:picks:deck:other-deck')
      renderBuilder()
      expect(screen.queryByRole('button', { name: /^Discard/ })).not.toBeInTheDocument()
    })

    it('starts empty when what was kept is unreadable', () => {
      localStorage.setItem(deckPicks, '{not json')
      renderBuilder()
      expect(screen.queryByRole('button', { name: /^Discard/ })).not.toBeInTheDocument()
    })

    it('still builds a plan when storage refuses', async () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('Full', 'QuotaExceededError')
      })
      const user = userEvent.setup({ delay: null })
      renderBuilder()
      await user.click(screen.getByRole('button', { name: 'Add to plan: Picnic' }))
      expect(screen.getByRole('button', { name: 'Discard: Picnic' })).toBeInTheDocument()
    })

    /** @see docs/plans.md § "Picks are kept in the browser" - picks kept before there were groups */
    it('reads picks kept before there were groups', () => {
      localStorage.setItem(deckPicks, JSON.stringify(['museum']))
      renderBuilder()
      expect(screen.getByRole('button', { name: 'Discard: Museum' })).toBeInTheDocument()
    })
  })

  /** @see docs/card-layout.md § "Flying cards" - Clear plan sends every card back into the deck */
  it('empties the plan with Clear plan', async () => {
    const user = userEvent.setup({ delay: null })
    renderBuilder()

    await user.click(screen.getByRole('button', { name: 'Add to plan: Picnic' }))
    await user.click(screen.getByRole('button', { name: 'Add to plan: Hike' }))
    await user.click(screen.getByRole('button', { name: 'Clear plan' }))

    expect(await screen.findByRole('button', { name: 'Add to plan: Picnic' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Add to plan: Hike' })).toBeInTheDocument()
    expect(keptPicks()).toBeNull()
  })

  describe('reordering the plan', () => {
    /** @see docs/card-layout.md § "Reordering the plan" - by its grip */
    it('gives cards in the plan a grip, and cards in the deck none', async () => {
      keepPicks(['museum'])
      renderBuilder()
      expect(await screen.findByRole('button', { name: 'Move Museum' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Move Picnic' })).not.toBeInTheDocument()
    })

    /** @see docs/card-layout.md § "Reordering the plan" - from the keyboard, and kept in the browser */
    it('moves a card up and down the plan with the arrow keys on its grip', async () => {
      keepPicks(['picnic', 'museum', 'hike'])
      const user = userEvent.setup({ delay: null })
      const { container } = renderBuilder()
      const grip = await screen.findByRole('button', { name: 'Move Picnic' })

      act(() => grip.focus())
      await user.keyboard('{ArrowDown}')
      expect(planOrder(container)).toEqual(['museum', 'picnic', 'hike'])
      expect(keptPicks()).toEqual(picks(['museum', 'picnic', 'hike']))
      expect(screen.getByRole('button', { name: 'Move Picnic' })).toHaveFocus()

      await user.keyboard('{ArrowDown}{ArrowDown}')
      expect(planOrder(container)).toEqual(['museum', 'hike', 'picnic'])

      await user.keyboard('{ArrowUp}')
      expect(planOrder(container)).toEqual(['museum', 'picnic', 'hike'])
    })

    /** @see docs/card-layout.md § "Reordering the plan" - from the keyboard */
    it('takes left and right as up and down', async () => {
      keepPicks(['picnic', 'museum'])
      const user = userEvent.setup({ delay: null })
      const { container } = renderBuilder()

      act(() => screen.getByRole('button', { name: 'Move Picnic' }).focus())
      await user.keyboard('{ArrowRight}')
      expect(planOrder(container)).toEqual(['museum', 'picnic'])
      await user.keyboard('{ArrowLeft}')
      expect(planOrder(container)).toEqual(['picnic', 'museum'])
    })

    /** @see docs/card-layout.md § "Reordering the plan" - the new order is the one that's shared */
    it('saves the plan in its new order', async () => {
      savePlan.mockResolvedValue({ ok: true, data: { planId: 'plan42' } })
      keepPicks(['picnic', 'hike'])
      const user = userEvent.setup({ delay: null })
      renderBuilder()

      const grip = await screen.findByRole('button', { name: 'Move Hike' })
      act(() => grip.focus())
      await user.keyboard('{ArrowUp}')
      await user.click(screen.getByRole('button', { name: 'Save plan' }))
      expect(savePlan).toHaveBeenCalledWith('share123', ['hike', 'picnic'], [], drawn)
    })

    describe('with a mouse', () => {
      beforeEach(() => {
        vi.spyOn(window, 'matchMedia').mockImplementation(mediaMatching('(hover: hover)'))
      })

      /** @see docs/card-layout.md § "Reordering the plan" - not a click */
      it("doesn't discard the card or open its notes when the grip is pressed", async () => {
        keepPicks(['museum'])
        const user = userEvent.setup({ delay: null })
        renderBuilder()

        await user.click(await screen.findByRole('button', { name: 'Move Museum' }))
        expect(screen.getByRole('button', { name: 'Discard: Museum' })).toBeInTheDocument()
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })

      it("doesn't mark a side of the card while the mouse is over the grip", async () => {
        keepPicks(['museum'])
        const { container } = renderBuilder()
        fireEvent.pointerMove(await screen.findByRole('button', { name: 'Move Museum' }), { pointerType: 'mouse' })
        const card = container.querySelector('[data-card-id="museum"]') as HTMLElement
        expect(card.dataset.side).toBeUndefined()
      })
    })

    /** @see docs/card-layout.md § "Reordering the plan" - only the grip, on a touch screen */
    describe('on a touch screen', () => {
      // A touch pressed on something in a card, then moved well past where
      // a drag starts.
      function swipe(from: Element) {
        fireEvent.pointerDown(from, { pointerType: 'touch', pointerId: 7, button: 0, clientX: 50, clientY: 50 })
        fireEvent.pointerMove(window, { pointerType: 'touch', pointerId: 7, clientX: 50, clientY: 120 })
      }
      const dragging = (container: HTMLElement) =>
        container.querySelector('[data-plan-scroll]')?.hasAttribute('data-dragging')

      it("doesn't drag a card from anywhere but its grip, so a swipe still scrolls the plan", async () => {
        keepPicks(['picnic', 'museum'])
        const { container } = renderBuilder()
        await screen.findByRole('button', { name: 'Move Museum' })
        swipe(container.querySelector('[data-card-id="museum"] [class*="title"]') as Element)
        expect(dragging(container)).toBe(false)
        fireEvent.pointerUp(window, { pointerType: 'touch', pointerId: 7 })
      })

      it('drags a card from its grip', async () => {
        keepPicks(['picnic', 'museum'])
        const { container } = renderBuilder()
        swipe(await screen.findByRole('button', { name: 'Move Museum' }))
        expect(dragging(container)).toBe(true)
        fireEvent.pointerUp(window, { pointerType: 'touch', pointerId: 7 })
        // Settled, and past the moment after it where the drag swallows the
        // click its letting go makes, which would otherwise swallow the next
        // test's first click.
        await waitFor(() => expect(dragging(container)).toBe(false))
        await act(() => new Promise((resolve) => setTimeout(resolve, 0)))
      })
    })
  })

  /** @see docs/plans.md § "Groups" */
  describe('groups', () => {
    function rowOf(container: HTMLElement, id: string) {
      return container
        .querySelector(`[data-card-id="${id}"]`)
        ?.closest('[data-plan-row]')
        ?.getAttribute('data-plan-row')
    }

    function groupId() {
      return keptPicks().groups[0].id as string
    }

    it('adds an empty group, ready for its title, and keeps its title and notes', async () => {
      const user = userEvent.setup({ delay: null })
      renderBuilder()

      await user.click(screen.getByRole('button', { name: 'Add group' }))
      const title = screen.getByRole('textbox', { name: 'Title of Group 1' })
      expect(title).toHaveFocus()
      expect(screen.getByText('Drag ideas here')).toBeInTheDocument()
      await user.type(title, 'Dinner')
      await user.type(screen.getByRole('textbox', { name: 'Notes on Dinner' }), 'Book a table')

      expect(keptPicks()).toEqual(picks([], [{ id: groupId(), title: 'Dinner', notes: 'Book a table', cardIds: [] }]))
      // There's a plan to act on now, even with no cards yet.
      expect(screen.getByRole('button', { name: 'Save plan' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Clear plan' })).toBeVisible()
    })

    /** @see docs/plans.md § "Groups" - called Group 1, Group 2 and so on, by its place */
    it('names groups without a title by their place', async () => {
      const user = userEvent.setup({ delay: null })
      renderBuilder()

      await user.click(screen.getByRole('button', { name: 'Add group' }))
      await user.click(screen.getByRole('button', { name: 'Add group' }))
      expect(screen.getByRole('textbox', { name: 'Title of Group 2' })).toHaveFocus()
      await user.type(screen.getByRole('textbox', { name: 'Notes on Group 2' }), 'Get a taxi home')

      await user.click(screen.getByRole('button', { name: 'Remove Group 1' }))
      expect(screen.queryByRole('textbox', { name: 'Title of Group 2' })).not.toBeInTheDocument()
      expect(screen.getByRole('textbox', { name: 'Notes on Group 1' })).toHaveValue('Get a taxi home')
    })

    /** @see docs/card-layout.md § "Reordering the plan" - from the keyboard */
    it('moves a card down into a group and back up with the arrow keys on its grip', async () => {
      keepPicks(picks(['picnic', 'museum'], [{ id: 'g', title: 'Later', notes: '', cardIds: [] }]))
      const user = userEvent.setup({ delay: null })
      const { container } = renderBuilder()

      act(() => screen.getByRole('button', { name: 'Move Museum' }).focus())
      await user.keyboard('{ArrowDown}')
      expect(rowOf(container, 'museum')).toBe('g')
      expect(keptPicks()).toEqual(picks(['picnic'], [{ id: 'g', title: 'Later', notes: '', cardIds: ['museum'] }]))
      await waitFor(() => expect(screen.getByRole('button', { name: 'Move Museum' })).toHaveFocus())
      expect(screen.queryByText('Drag ideas here')).not.toBeInTheDocument()

      await user.keyboard('{ArrowDown}')
      expect(rowOf(container, 'museum')).toBe('g')
      await user.keyboard('{ArrowUp}')
      // Back onto the end of the row above.
      expect(rowOf(container, 'museum')).toBe('')
      expect(keptPicks().cardIds).toEqual(['picnic', 'museum'])
    })

    it('puts the cards of a removed group back in the plan', async () => {
      keepPicks(picks(['picnic'], [{ id: 'g', title: 'Later', notes: '', cardIds: ['hike'] }]))
      const user = userEvent.setup({ delay: null })
      const { container } = renderBuilder()

      await user.click(screen.getByRole('button', { name: 'Remove Later' }))
      expect(screen.queryByRole('region', { name: 'Later' })).not.toBeInTheDocument()
      expect(rowOf(container, 'hike')).toBe('')
      expect(keptPicks()).toEqual(picks(['picnic', 'hike']))
    })

    it('discards a card from a group back into the deck', async () => {
      keepPicks(picks([], [{ id: 'g', title: 'Later', notes: '', cardIds: ['hike'] }]))
      const user = userEvent.setup({ delay: null })
      renderBuilder()

      await user.click(screen.getByRole('button', { name: 'Discard: Hike' }))
      expect(await screen.findByRole('button', { name: 'Add to plan: Hike' })).toBeInTheDocument()
      expect(keptPicks()).toEqual(picks([], [{ id: 'g', title: 'Later', notes: '', cardIds: [] }]))
    })

    it('saves the groups with the plan', async () => {
      savePlan.mockResolvedValue({ ok: true, data: { planId: 'plan42' } })
      const group = { id: 'g', title: 'Later', notes: 'Bring cash', cardIds: ['hike'] }
      keepPicks(picks(['picnic'], [group]))
      const user = userEvent.setup({ delay: null })
      renderBuilder()

      expect(screen.getByRole('textbox', { name: 'Title of Later' })).toHaveValue('Later')
      await user.click(screen.getByRole('button', { name: 'Save plan' }))
      expect(savePlan).toHaveBeenCalledWith('share123', ['picnic'], [group], drawn)
    })

    it('empties the groups too with Clear plan', async () => {
      keepPicks(picks(['picnic'], [{ id: 'g', title: 'Later', notes: '', cardIds: ['hike'] }]))
      const user = userEvent.setup({ delay: null })
      renderBuilder()

      await user.click(screen.getByRole('button', { name: 'Clear plan' }))
      expect(screen.queryByRole('region', { name: 'Later' })).not.toBeInTheDocument()
      expect(keptPicks()).toBeNull()
    })

    it("starts from a saved plan's groups, and saves changes to them over it", async () => {
      updatePlan.mockResolvedValue({ ok: true, data: { planId: 'plan42' } })
      const user = userEvent.setup({ delay: null })
      render(
        <PlanBuilder
          deckName="Test deck"
          shareId="share123"
          cards={cards}
          seed={1}
          plan={{ id: 'plan42', cardIds: [], groups: [{ id: 'g', title: 'Later', notes: '', cardIds: ['hike'] }] }}
        />,
      )

      const title = screen.getByRole('textbox', { name: 'Title of Later' })
      await user.clear(title)
      await user.type(title, 'Soon')
      await user.click(screen.getByRole('button', { name: 'Update Plan' }))
      expect(updatePlan).toHaveBeenCalledWith(
        'plan42',
        [],
        [{ id: 'g', title: 'Soon', notes: '', cardIds: ['hike'] }],
        drawn,
      )
    })
  })
})
