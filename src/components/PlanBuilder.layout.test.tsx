/** @vitest-environment jsdom */
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mediaMatching } from '@/test/media'
import { keepPicks, picks, renderBuilder, resetPlanBuilder } from '@/test/plan-builder'

vi.mock('@/lib/actions/plans', () => import('@/test/plan-builder-mocks'))
vi.mock('@/lib/actions/decks', () => import('@/test/plan-builder-mocks'))
vi.mock('@/lib/actions/preferences', () => import('@/test/plan-builder-mocks'))
vi.mock('@/lib/og/client', () => import('@/test/plan-builder-mocks'))
vi.mock('next/navigation', () => import('@/test/plan-builder-mocks'))
vi.mock('next/link', () => import('@/test/plan-builder-mocks'))

beforeEach(resetPlanBuilder)
afterEach(() => vi.restoreAllMocks())

describe('PlanBuilder', () => {
  describe('the plan column', () => {
    /**
     * @see docs/card-layout.md § "The plan column"
     * @see docs/card-layout.md § "Narrow screens" - both columns are in use on a wide screen
     */
    it('puts the deck before the plan, and both are in use on a wide screen', async () => {
      keepPicks(['museum'])
      renderBuilder()
      const plan = screen.getByRole('region', { name: 'Your plan' })
      const deck = screen.getByRole('region', { name: 'Date ideas' })
      expect(deck.compareDocumentPosition(plan) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(plan).not.toHaveAttribute('inert')
      expect(deck).not.toHaveAttribute('inert')
      expect(screen.queryByRole('button', { name: 'Show your plan' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Show the date ideas' })).not.toBeInTheDocument()
    })
  })

  /** @see docs/card-layout.md § "Save plan and Clear plan" */
  describe('the bar above the columns', () => {
    it('says how to start a plan until there is one, in place of the buttons', () => {
      const { container } = renderBuilder()
      const bar = container.querySelector('.builder-bar') as HTMLElement
      expect(within(bar).getByText('Pick a card from the deck')).toBeInTheDocument()
      expect(within(bar).queryByRole('button', { name: 'Save plan' })).not.toBeInTheDocument()
      expect(within(bar).queryByRole('button', { name: 'Clear plan' })).not.toBeInTheDocument()
    })

    it('has Save plan and Clear plan once something is picked, outside both columns', async () => {
      const user = userEvent.setup({ delay: null })
      const { container } = renderBuilder()
      await user.click(screen.getByRole('button', { name: 'Draw random card' }))

      const bar = container.querySelector('.builder-bar') as HTMLElement
      expect(within(bar).queryByText('Pick a card from the deck')).not.toBeInTheDocument()
      expect(within(bar).getByRole('button', { name: 'Save plan' })).toBeEnabled()
      expect(within(bar).getByRole('button', { name: 'Save plan' }).closest('[inert]')).toBeNull()
      expect(within(bar).getByRole('button', { name: 'Clear plan' })).toBeInTheDocument()
      // Cancel is only for editing a saved plan.
      expect(within(bar).queryByRole('link', { name: 'Cancel' })).not.toBeInTheDocument()
      expect(bar.closest('.builder-column')).toBeNull()
    })
  })

  /** @see docs/card-layout.md § "The plan column" - the slot */
  describe('the slot in the plan', () => {
    it('is a blank slot, with Draw random card, until something is picked', () => {
      const { container } = renderBuilder()
      const slot = container.querySelector('.plan-track .empty-slot')
      expect(slot).toBeInTheDocument()
      expect(slot).toHaveTextContent('')
      expect(screen.getByRole('button', { name: 'Draw random card' })).toBeInTheDocument()
    })

    it('stays under the first card picked while it flies there, then goes', async () => {
      // jsdom lays nothing out, so the flight would have nowhere to land.
      vi.spyOn(HTMLElement.prototype, 'offsetParent', 'get').mockImplementation(function (this: HTMLElement) {
        return this.parentElement
      })
      const { container } = renderBuilder()

      fireEvent.click(screen.getByRole('button', { name: 'Add to plan: Museum' }))
      const flying = document.body.querySelector(':scope > [aria-hidden="true"]') as HTMLElement
      expect(within(flying).getByText('Museum')).toBeInTheDocument()
      expect(container.querySelector('.plan-track .empty-slot')).toHaveAttribute('data-covered', 'true')

      await waitFor(() => expect(flying).not.toBeInTheDocument())
      expect(container.querySelector('.plan-track .empty-slot')).not.toBeInTheDocument()
    })

    it('goes once something is picked, leaving Draw random card, which picks another', async () => {
      keepPicks(['museum'])
      const user = userEvent.setup({ delay: null })
      const { container } = renderBuilder()
      expect(container.querySelector('.plan-track .empty-slot')).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Draw random card' }))
      expect(container.querySelectorAll('[data-card-id]')).toHaveLength(2)
    })

    it('goes when every card is in a group too', () => {
      keepPicks(picks([], [{ id: 'g', title: 'Later', notes: '', cardIds: ['hike'] }]))
      const { container } = renderBuilder()
      expect(container.querySelector('.plan-track .empty-slot')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Draw random card' })).toBeInTheDocument()
    })

    /** @see docs/card-layout.md § "The plan column" - Draw random card */
    it('has no Draw random card once every idea is in the plan', () => {
      keepPicks(['picnic', 'museum', 'hike'])
      renderBuilder()
      expect(screen.queryByRole('button', { name: 'Draw random card' })).not.toBeInTheDocument()
    })

    /** @see docs/card-layout.md § "The plan column" - Draw random card */
    it('has no Draw random card once every idea the filters show is in the plan', async () => {
      const user = userEvent.setup({ delay: null })
      renderBuilder()

      await user.click(
        within(screen.getByRole('group', { name: 'Filter ideas' })).getByRole('button', { name: 'culture' }),
      )
      await user.click(screen.getByRole('button', { name: 'Add to plan: Museum' }))
      expect(screen.queryByRole('button', { name: 'Draw random card' })).not.toBeInTheDocument()

      await user.click(within(screen.getByRole('group', { name: 'Filter ideas' })).getByRole('button', { name: 'All' }))
      expect(screen.getByRole('button', { name: 'Draw random card' })).toBeInTheDocument()
    })
  })

  /** @see docs/card-layout.md § "Narrow screens" - the last column used */
  describe('narrowing the screen', () => {
    // A screen that starts wide, and can be made narrow.
    function resizableScreen() {
      let narrow = false
      const listeners = new Set<() => void>()
      vi.spyOn(window, 'matchMedia').mockImplementation(
        (query) =>
          ({
            get matches() {
              return query === '(max-width: 899px)' && narrow
            },
            media: query,
            addEventListener: (_: string, listener: () => void) => listeners.add(listener),
            removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
          }) as unknown as MediaQueryList,
      )
      return {
        narrow() {
          narrow = true
          act(() => {
            for (const listener of listeners) listener()
          })
        },
      }
    }

    it('keeps the deck in use when nothing has been used yet', () => {
      const screenSize = resizableScreen()
      renderBuilder()
      screenSize.narrow()
      expect(screen.getByRole('region', { name: 'Your plan' })).toHaveAttribute('inert')
      expect(screen.getByRole('region', { name: 'Date ideas' })).not.toHaveAttribute('inert')
    })

    it('keeps the plan in use when something in it was used last', async () => {
      const screenSize = resizableScreen()
      const user = userEvent.setup({ delay: null })
      renderBuilder()
      await user.click(screen.getByRole('button', { name: 'Add group' }))
      screenSize.narrow()
      expect(screen.getByRole('region', { name: 'Your plan' })).not.toHaveAttribute('inert')
      expect(screen.getByRole('region', { name: 'Date ideas' })).toHaveAttribute('inert')
      expect(screen.getByRole('button', { name: 'Show the date ideas' })).toBeInTheDocument()
    })

    it('keeps the deck in use when a card in it was used after the plan', async () => {
      const screenSize = resizableScreen()
      const user = userEvent.setup({ delay: null })
      const { container } = renderBuilder()
      await user.click(screen.getByRole('button', { name: 'Add group' }))
      await user.click(container.querySelector('[data-deck-card-id="museum"]') as HTMLElement)
      screenSize.narrow()
      expect(screen.getByRole('region', { name: 'Date ideas' })).not.toHaveAttribute('inert')
      expect(screen.getByRole('region', { name: 'Your plan' })).toHaveAttribute('inert')
    })

    it('counts focus from the keyboard as using a column', async () => {
      keepPicks(['museum'])
      const screenSize = resizableScreen()
      renderBuilder()
      act(() => screen.getByRole('button', { name: 'Move Museum' }).focus())
      screenSize.narrow()
      expect(screen.getByRole('region', { name: 'Your plan' })).not.toHaveAttribute('inert')
    })
  })

  /** @see docs/card-layout.md § "Narrow screens" */
  describe('on a narrow screen', () => {
    beforeEach(() => {
      vi.spyOn(window, 'matchMedia').mockImplementation(mediaMatching('(max-width: 899px)'))
    })

    it('starts with the deck in use and the plan shrunk', () => {
      const { container } = renderBuilder()
      expect(container.querySelector('.builder')).toHaveAttribute('data-active', 'deck')
      expect(screen.getByRole('region', { name: 'Your plan' })).toHaveAttribute('inert')
      expect(screen.getByRole('region', { name: 'Date ideas' })).not.toHaveAttribute('inert')
      expect(screen.getByRole('button', { name: 'Show your plan' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Show the date ideas' })).not.toBeInTheDocument()
    })

    it('puts a shrunk column in use when it is clicked, and shrinks the other', async () => {
      keepPicks(['museum'])
      const user = userEvent.setup({ delay: null })
      const { container } = renderBuilder()

      await user.click(screen.getByRole('button', { name: 'Show your plan' }))
      expect(container.querySelector('.builder')).toHaveAttribute('data-active', 'plan')
      expect(screen.getByRole('region', { name: 'Your plan' })).not.toHaveAttribute('inert')
      expect(screen.getByRole('region', { name: 'Date ideas' })).toHaveAttribute('inert')
      // The card in the plan survived the switch.
      expect(screen.getByRole('button', { name: 'Discard: Museum' })).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Show the date ideas' }))
      expect(container.querySelector('.builder')).toHaveAttribute('data-active', 'deck')
      expect(screen.getByRole('region', { name: 'Your plan' })).toHaveAttribute('inert')
    })
  })
})
