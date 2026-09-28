/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mediaMatching } from '@/test/media'
import {
  cards,
  deckOrder,
  keepPicks,
  keptPicks,
  planOrder,
  renderBuilder,
  resetPlanBuilder,
  saveCard,
  saveCardNotes,
  saveDeckSort,
  savePlan,
} from '@/test/plan-builder'
import type { DateCard } from '@/types'
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
  describe('filtering by several tags', () => {
    function filterButton(name: string) {
      return within(screen.getByRole('group', { name: 'Filter ideas by tag' })).getByRole('button', { name })
    }

    it('shows only the ideas with every selected tag', async () => {
      const user = userEvent.setup({ delay: null })
      renderBuilder()

      await user.click(filterButton('outside'))
      await user.click(filterButton('active'))
      expect(screen.getByRole('button', { name: 'Add to plan: Hike' })).toBeInTheDocument()
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Add to plan: Picnic' })).not.toBeInTheDocument())
      expect(screen.queryByRole('button', { name: 'Add to plan: Museum' })).not.toBeInTheDocument()
    })

    it('says when no idea has every tag, and can show them all again', async () => {
      const user = userEvent.setup({ delay: null })
      renderBuilder()

      await user.click(filterButton('culture'))
      await user.click(filterButton('active'))
      expect(screen.getByText('No ideas match every selected tag.')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Show all ideas' }))
      for (const card of cards)
        expect(await screen.findByRole('button', { name: `Add to plan: ${card.title}` })).toBeInTheDocument()
      expect(filterButton('culture')).toHaveAttribute('aria-pressed', 'false')
    })

    it('clears the filters with All', async () => {
      const user = userEvent.setup({ delay: null })
      renderBuilder()

      await user.click(filterButton('culture'))
      await user.click(filterButton('All'))
      for (const card of cards)
        expect(await screen.findByRole('button', { name: `Add to plan: ${card.title}` })).toBeInTheDocument()
      expect(filterButton('culture')).toHaveAttribute('aria-pressed', 'false')
    })
  })

  /** @see docs/deck-sorting.md § "Sort options" */
  describe('sorting', () => {
    it('starts on Random', () => {
      renderBuilder()
      const sorts = screen.getByRole('group', { name: 'Sort ideas' })
      expect(within(sorts).getByRole('button', { name: 'Random' })).toHaveAttribute('aria-pressed', 'true')
    })

    it('puts the newest ideas first for Date added', async () => {
      const user = userEvent.setup({ delay: null })
      const { container } = renderBuilder()

      await user.click(screen.getByRole('button', { name: 'Date added' }))
      expect(screen.getByRole('button', { name: 'Date added' })).toHaveAttribute('aria-pressed', 'true')
      expect(deckOrder(container)).toEqual(['hike', 'museum', 'picnic'])
    })

    it('puts the highest rated ideas first for Interest', async () => {
      const user = userEvent.setup({ delay: null })
      const { container } = render(
        <PlanBuilder
          deckName="Test deck"
          shareId="share123"
          cards={[...cards.slice(0, 2), { ...cards[2], interest: 4 }]}
          seed={1}
        />,
      )

      await user.click(screen.getByRole('button', { name: 'Interest' }))
      expect(deckOrder(container)).toEqual(['hike', 'picnic', 'museum'])
    })

    /** @see docs/deck-sorting.md § "Sort options" - rating a card moves it straight away */
    it('moves an idea as soon as it is rated', async () => {
      const user = userEvent.setup({ delay: null })
      const { container } = renderBuilder()

      await user.click(screen.getByRole('button', { name: 'Interest' }))
      await user.click(screen.getByRole('button', { name: 'Notes on Museum' }))
      const notes = await screen.findByRole('dialog', { name: 'Museum' })
      await user.click(within(notes).getByRole('radio', { name: '5 stars' }))
      await waitFor(() => expect(deckOrder(container)[0]).toBe('museum'))
    })

    /** @see docs/deck-sorting.md § "How it fits with filters and the plan" */
    it('sorts only the ideas the filters show', async () => {
      const user = userEvent.setup({ delay: null })
      const { container } = renderBuilder()

      await user.click(
        within(screen.getByRole('group', { name: 'Filter ideas by tag' })).getByRole('button', { name: 'outside' }),
      )
      await user.click(screen.getByRole('button', { name: 'Date added' }))
      await waitFor(() => expect(deckOrder(container)).toEqual(['hike', 'picnic']))
    })
  })

  /** @see docs/deck-sorting.md § "Remembering the choice" */
  describe('remembering the sort', () => {
    it('starts on the sort it is given', () => {
      render(<PlanBuilder deckName="Test deck" shareId="share123" cards={cards} seed={1} initialSort="added" />)
      expect(screen.getByRole('button', { name: 'Date added' })).toHaveAttribute('aria-pressed', 'true')
    })

    it('saves a new pick for a signed-in visitor', async () => {
      const user = userEvent.setup({ delay: null })
      render(<PlanBuilder deckName="Test deck" shareId="share123" cards={cards} seed={1} remembersSort />)

      await user.click(screen.getByRole('button', { name: 'Interest' }))
      expect(saveDeckSort).toHaveBeenCalledExactlyOnceWith('interest')
      await user.click(screen.getByRole('button', { name: 'Interest' }))
      expect(saveDeckSort).toHaveBeenCalledOnce()
    })

    it('saves nothing for someone signed out', async () => {
      const user = userEvent.setup({ delay: null })
      renderBuilder()

      await user.click(screen.getByRole('button', { name: 'Interest' }))
      expect(saveDeckSort).not.toHaveBeenCalled()
    })

    it('still sorts when saving fails', async () => {
      const user = userEvent.setup({ delay: null })
      saveDeckSort.mockRejectedValue(new Error('offline'))
      render(<PlanBuilder deckName="Test deck" shareId="share123" cards={cards} seed={1} remembersSort />)

      await user.click(screen.getByRole('button', { name: 'Date added' }))
      expect(screen.getByRole('button', { name: 'Date added' })).toHaveAttribute('aria-pressed', 'true')
    })
  })

  /** @see docs/deck-sorting.md § "How it fits with filters and the plan" */
  describe('sorting with the plan', () => {
    it('keeps the plan in the order the cards were picked', async () => {
      const user = userEvent.setup({ delay: null })
      const { container } = renderBuilder()

      await user.click(screen.getByRole('button', { name: 'Add to plan: Picnic' }))
      await user.click(screen.getByRole('button', { name: 'Add to plan: Hike' }))
      await user.click(screen.getByRole('button', { name: 'Date added' }))
      await user.click(screen.getByRole('button', { name: 'Interest' }))
      expect(planOrder(container)).toEqual(['picnic', 'hike'])
    })

    it('only picks a random idea from the ones the filters show', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.99)
      const user = userEvent.setup({ delay: null })
      renderBuilder()

      await user.click(
        within(screen.getByRole('group', { name: 'Filter ideas by tag' })).getByRole('button', { name: 'culture' }),
      )
      await user.click(screen.getByRole('button', { name: 'Draw random card' }))
      expect(await screen.findByRole('button', { name: 'Discard: Museum' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Discard: Picnic' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Discard: Hike' })).not.toBeInTheDocument()
    })
  })

  /** @see docs/card-notes.md § "Editing a card" */
  describe('editing the deck', () => {
    function renderForEditor(deckCards = cards, seed = 1) {
      return <PlanBuilder deckName="Test deck" shareId="share123" cards={deckCards} seed={seed} deckId="deck1" />
    }

    it("gives no way to edit to someone who can't", () => {
      renderBuilder()
      expect(screen.queryByRole('button', { name: 'Edit Picnic' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Add an idea' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Quick Add' })).not.toBeInTheDocument()
    })

    it("opens a card's edit form from its edit button, without adding it to the plan", async () => {
      vi.spyOn(window, 'matchMedia').mockImplementation(mediaMatching('(hover: hover)'))
      const user = userEvent.setup({ delay: null })
      render(renderForEditor())

      await user.click(screen.getByRole('button', { name: 'Edit Picnic' }))
      const form = await screen.findByRole('dialog', { name: 'Edit idea' })
      expect(within(form).getByRole('textbox', { name: /^Title/ })).toHaveValue('Picnic')
      expect(screen.getByRole('button', { name: 'Add to plan: Picnic' })).toBeInTheDocument()
      expect(keptPicks()).toBeNull()

      await user.clear(within(form).getByRole('textbox', { name: /^Title/ }))
      await user.type(within(form).getByRole('textbox', { name: /^Title/ }), 'Picnic by the river')
      await user.click(within(form).getByRole('button', { name: 'Save' }))
      expect(saveCard).toHaveBeenCalledWith('deck1', 'picnic', {
        title: 'Picnic by the river',
        description: '',
        tags: ['outside'],
        date: '',
      })
    })

    it('has an edit button on cards in the plan too', async () => {
      keepPicks(['museum'])
      const { container } = render(renderForEditor())
      expect(await screen.findByRole('button', { name: 'Discard: Museum' })).toBeInTheDocument()
      const planCard = container.querySelector('[data-card-id="museum"]') as HTMLElement
      expect(within(planCard).getByRole('button', { name: 'Edit Museum' })).toBeInTheDocument()
    })

    it("doesn't mark a side of the card while the mouse is over the edit button", () => {
      const { container } = render(renderForEditor())
      const card = container.querySelector('[data-deck-card-id="picnic"]') as HTMLElement
      fireEvent.pointerMove(screen.getByRole('button', { name: 'Edit Picnic' }), { pointerType: 'mouse' })
      expect(card.dataset.side).toBeUndefined()
    })

    /** @see docs/quick-add.md § "Adding an idea" */
    it('offers Add an idea and Quick Add in the last spot in the deck', async () => {
      const user = userEvent.setup({ delay: null })
      const { container } = render(renderForEditor())
      const grid = container.querySelector('.card-grid') as HTMLElement
      expect(grid.lastElementChild).toContainElement(screen.getByRole('button', { name: 'Add an idea' }))
      expect(grid.lastElementChild).toContainElement(screen.getByRole('button', { name: 'Quick Add' }))

      await user.click(screen.getByRole('button', { name: 'Add an idea' }))
      expect(await screen.findByRole('heading', { name: 'New idea' })).toBeInTheDocument()
      expect(screen.getByRole('textbox', { name: /^Title/ })).toHaveValue('')
      await user.click(screen.getByRole('button', { name: 'Cancel' }))

      await user.click(screen.getByRole('button', { name: 'Quick Add' }))
      expect(screen.getByRole('textbox', { name: /^Describe the idea/ })).toBeInTheDocument()
    })

    it("doesn't reshuffle when the edited cards come back, and puts a new card first", async () => {
      const { container, rerender } = render(renderForEditor())
      const before = deckOrder(container)

      const golf: DateCard = { id: 'golf', title: 'Golf', description: '', tags: [] }
      rerender(renderForEditor([{ ...cards[0], title: 'Picnic by the river' }, cards[1], cards[2], golf], 99))
      expect(deckOrder(container)).toEqual(['golf', ...before])
      expect(screen.getByRole('button', { name: 'Add to plan: Picnic by the river' })).toBeInTheDocument()

      rerender(renderForEditor([cards[1], cards[2], golf], 7))
      await waitFor(() => expect(deckOrder(container)).toEqual(['golf', ...before.filter((id) => id !== 'picnic')]))
    })

    /** @see docs/card-notes.md § "Editing a card" - ratings and notes changed on this visit stay as they were */
    it('keeps the ratings and notes changed on this visit when the edited cards come back', async () => {
      const user = userEvent.setup({ delay: null })
      const { container, rerender } = render(renderForEditor())

      await user.click(screen.getByRole('button', { name: 'Notes on Museum' }))
      const notes = await screen.findByRole('dialog', { name: 'Museum' })
      await user.click(within(notes).getByRole('radio', { name: '4 stars' }))
      await user.click(within(notes).getByRole('button', { name: 'Done' }))
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Museum' })).not.toBeInTheDocument())

      // The cards from before the rating was saved.
      rerender(renderForEditor([{ ...cards[0], title: 'Picnic by the river' }, cards[1], cards[2]]))
      const museum = container.querySelector('[data-deck-card-id="museum"]') as HTMLElement
      expect(within(museum).getByText('Rated 4 out of 5.')).toBeInTheDocument()
    })

    it('drops a deleted card from the plan', async () => {
      keepPicks(['museum'])
      const { rerender } = render(renderForEditor())
      expect(await screen.findByRole('button', { name: 'Discard: Museum' })).toBeInTheDocument()

      rerender(renderForEditor([cards[0], cards[2]]))
      await waitFor(() => expect(keptPicks()).toBeNull())
      expect(screen.queryByRole('button', { name: 'Discard: Museum' })).not.toBeInTheDocument()
    })
  })

  describe('footer', () => {
    /** @see docs/deck-sharing.md § "Asking for edit access" - owners and editors see Edit this deck instead */
    it('links owners and editors to the deck editor', () => {
      render(<PlanBuilder deckName="Test deck" shareId="share123" cards={cards} seed={1} editHref="/decks/deck1" />)
      expect(screen.getByRole('link', { name: 'Edit this deck' })).toHaveAttribute('href', '/decks/deck1')
      expect(screen.queryByRole('link', { name: 'Request edit access' })).not.toBeInTheDocument()
    })

    /** @see docs/deck-sharing.md § "Asking for edit access" - someone who has already asked sees that they have */
    it('says so once someone has asked to edit', () => {
      render(<PlanBuilder deckName="Test deck" shareId="share123" cards={cards} seed={1} access="pending" />)
      expect(screen.getByText("You've asked to edit this deck")).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'Request edit access' })).not.toBeInTheDocument()
    })

    /** @see docs/deck-sharing.md § "Asking for edit access" - the footer shows Request edit access */
    it('offers to request edit access', () => {
      renderBuilder()
      expect(screen.getByRole('link', { name: 'Request edit access' })).toHaveAttribute('href', '/d/share123/request')
    })

    /** @see docs/deck-sharing.md § "Who can do what" - owners and editors see the deck's plans */
    it("lists the deck's plans when it's given them", () => {
      render(
        <PlanBuilder
          deckName="Test deck"
          shareId="share123"
          cards={cards}
          seed={1}
          plans={[{ id: 'plan42', createdAt: new Date('2026-09-20T10:00:00Z'), cards: 2 }]}
        />,
      )
      const plans = screen.getByRole('region', { name: 'Plans' })
      expect(within(plans).getByRole('heading', { name: 'Plans (1)' })).toBeInTheDocument()
      expect(within(plans).getByRole('link')).toHaveAttribute('href', '/p/plan42')
      expect(within(plans).getByText('2 ideas')).toBeInTheDocument()
    })
  })

  /** @see docs/sample-deck.md § "What's different" */
  describe('the sample deck', () => {
    function renderSample() {
      return render(<PlanBuilder deckName="Sample Deck" shareId="sample" cards={cards} seed={1} sample />)
    }

    it('offers to make a deck in place of Save plan', async () => {
      const user = userEvent.setup({ delay: null })
      renderSample()

      await user.click(screen.getByRole('button', { name: 'Add to plan: Hike' }))
      expect(screen.getByText('To save a plan')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Create your own deck' })).toHaveAttribute('href', '/sign-up')
      expect(screen.queryByRole('button', { name: 'Save plan' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Clear plan' })).toBeInTheDocument()
      expect(savePlan).not.toHaveBeenCalled()
    })

    it("doesn't save ratings or notes, but keeps them on the card for the visit", async () => {
      const user = userEvent.setup({ delay: null })
      const { container } = renderSample()

      await user.click(screen.getByRole('button', { name: 'Notes on Hike' }))
      let notes = await screen.findByRole('dialog', { name: 'Hike' })
      await user.click(within(notes).getByRole('radio', { name: '4 stars' }))
      await user.type(within(notes).getByRole('textbox', { name: 'Notes' }), 'Early start')
      expect(within(notes).getByRole('status')).toHaveTextContent('')
      await user.click(within(notes).getByRole('button', { name: 'Done' }))
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Hike' })).not.toBeInTheDocument())
      expect(saveCardNotes).not.toHaveBeenCalled()
      const hike = container.querySelector('[data-deck-card-id="hike"]') as HTMLElement
      expect(within(hike).getByText('Rated 4 out of 5. Has notes.')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Notes on Hike' }))
      notes = await screen.findByRole('dialog', { name: 'Hike' })
      expect(within(notes).getByRole('textbox', { name: 'Notes' })).toHaveValue('Early start')
    })

    it('has no footer links', () => {
      renderSample()
      expect(screen.queryByRole('link', { name: 'Request edit access' })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'Edit this deck' })).not.toBeInTheDocument()
    })

    /** @see docs/sample-deck.md § "The deck" */
    it('says it is a sample deck to try out', () => {
      renderSample()
      expect(screen.getByText(/A sample deck to try out/)).toBeInTheDocument()
    })
  })
})
