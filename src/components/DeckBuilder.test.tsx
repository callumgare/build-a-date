/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DateCard } from '@/types'
import DeckBuilder from './DeckBuilder'

const { savePlan, updatePlan, saveCardNotes } = vi.hoisted(() => ({
  savePlan: vi.fn(),
  updatePlan: vi.fn(),
  saveCardNotes: vi.fn(),
}))
vi.mock('@/lib/actions/plans', () => ({ savePlan, updatePlan, saveCardNotes }))
const deckActions = vi.hoisted(() => ({ saveCard: vi.fn(), deleteCard: vi.fn(), quickAddCard: vi.fn() }))
vi.mock('@/lib/actions/decks', () => deckActions)
const { saveDeckSort } = vi.hoisted(() => ({ saveDeckSort: vi.fn() }))
vi.mock('@/lib/actions/preferences', () => ({ saveDeckSort }))
vi.mock('next/link', () => ({ default: (props: object) => <a {...props} /> }))
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => router }))

const cards: DateCard[] = [
  { id: 'picnic', title: 'Picnic', description: '', tags: ['outside'], interest: 2, notes: 'Bring a rug' },
  { id: 'museum', title: 'Museum', description: 'See [the gallery](https://example.com)', tags: ['culture'] },
  { id: 'hike', title: 'Hike', description: '', tags: ['outside', 'active'] },
]

function renderBuilder() {
  return render(<DeckBuilder deckName="Test deck" shareId="share123" cards={cards} seed={1} />)
}

const deckPicks = 'build-a-date:picks:deck:share123'

// The picks this browser has kept for the deck, or null for none. Changes to
// a saved plan are kept in session storage instead.
function storageFor(key: string) {
  return key.includes(':plan:') ? sessionStorage : localStorage
}

function keptPicks(key = deckPicks) {
  return JSON.parse(storageFor(key).getItem(key) ?? 'null')
}

function keepPicks(ids: string[], key = deckPicks) {
  storageFor(key).setItem(key, JSON.stringify(ids))
}

beforeEach(() => {
  savePlan.mockReset()
  updatePlan.mockReset()
  router.push.mockReset()
  saveCardNotes.mockReset()
  saveCardNotes.mockResolvedValue({ ok: true, data: undefined })
  saveDeckSort.mockReset()
  saveDeckSort.mockResolvedValue({ ok: true, data: undefined })
  localStorage.clear()
  sessionStorage.clear()
  Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
})

describe('DeckBuilder', () => {
  it('shows the deck name and every card', () => {
    renderBuilder()
    expect(screen.getByRole('heading', { name: 'Test deck' })).toBeInTheDocument()
    for (const card of cards)
      expect(screen.getByRole('button', { name: `Add to plan: ${card.title}` })).toBeInTheDocument()
  })

  /** @see docs/card-notes.md § "Card actions" - plan cards have Discard and Notes */
  it('moves a picked card into the plan and back out', async () => {
    const user = userEvent.setup()
    renderBuilder()

    await user.click(screen.getByRole('button', { name: 'Add to plan: Picnic' }))
    expect(screen.getByRole('button', { name: 'Discard: Picnic' })).toBeInTheDocument()
    expect(keptPicks()).toEqual(['picnic'])

    await user.click(screen.getByRole('button', { name: 'Discard: Picnic' }))
    expect(await screen.findByRole('button', { name: 'Add to plan: Picnic' })).toBeInTheDocument()
  })

  /** @see docs/plans.md § "Picks are kept in the browser" */
  describe('keeping the picks', () => {
    afterEach(() => vi.restoreAllMocks())

    it('puts the picks kept for the deck straight into the plan', () => {
      keepPicks(['museum', 'not-a-card', 'museum'])
      renderBuilder()
      // Already there by the time the render returns, not added afterwards.
      expect(screen.getByRole('button', { name: 'Discard: Museum' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Add to plan: Museum' })).not.toBeInTheDocument()
      expect(screen.getAllByRole('button', { name: /^Discard/ })).toHaveLength(1)
    })

    it("doesn't put the picks in the URL", async () => {
      const user = userEvent.setup()
      renderBuilder()
      await user.click(screen.getByRole('button', { name: 'Add to plan: Picnic' }))
      expect(window.location.href).not.toContain('#')
    })

    it('forgets them once Done has saved them', async () => {
      savePlan.mockResolvedValue({ ok: true, data: { planId: 'plan42' } })
      const user = userEvent.setup()
      renderBuilder()

      await user.click(screen.getByRole('button', { name: 'Add to plan: Hike' }))
      expect(keptPicks()).toEqual(['hike'])
      await user.click(screen.getByRole('button', { name: 'Done' }))
      await waitFor(() => expect(router.push).toHaveBeenCalled())
      expect(keptPicks()).toBeNull()
    })

    it("keeps them when Done couldn't save", async () => {
      savePlan.mockResolvedValue({ ok: false, error: 'Deck not found' })
      const user = userEvent.setup()
      renderBuilder()

      await user.click(screen.getByRole('button', { name: 'Add to plan: Hike' }))
      await user.click(screen.getByRole('button', { name: 'Done' }))
      await screen.findByRole('alert')
      expect(keptPicks()).toEqual(['hike'])
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
      const user = userEvent.setup()
      renderBuilder()
      await user.click(screen.getByRole('button', { name: 'Add to plan: Picnic' }))
      expect(screen.getByRole('button', { name: 'Discard: Picnic' })).toBeInTheDocument()
    })
  })

  it('filters the deck by tag', async () => {
    const user = userEvent.setup()
    renderBuilder()
    const filters = screen.getByRole('group', { name: 'Filter ideas by tag' })

    await user.click(within(filters).getByRole('button', { name: 'culture' }))
    expect(await screen.findByRole('button', { name: 'Add to plan: Museum' })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Add to plan: Picnic' })).not.toBeInTheDocument())
  })

  /** @see docs/plans.md § "Sharing a plan" */
  it('saves the plan when Done is pressed and opens it, ready to share', async () => {
    savePlan.mockResolvedValue({ ok: true, data: { planId: 'plan42' } })
    const user = userEvent.setup()
    renderBuilder()

    await user.click(screen.getByRole('button', { name: 'Add to plan: Hike' }))
    await user.click(screen.getByRole('button', { name: 'Add to plan: Museum' }))
    expect(screen.queryByRole('link', { name: 'Cancel' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Done' }))

    expect(savePlan).toHaveBeenCalledWith('share123', ['hike', 'museum'])
    await waitFor(() => expect(router.push).toHaveBeenCalledExactlyOnceWith('/p/plan42?share'))
    // Saving till the page changes, so it can't be pressed twice.
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
  })

  it('shows why a plan could not be saved', async () => {
    savePlan.mockResolvedValue({ ok: false, error: 'Deck not found' })
    const user = userEvent.setup()
    renderBuilder()

    await user.click(screen.getByRole('button', { name: 'Add to plan: Hike' }))
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Deck not found')
  })

  describe('clicking a side of a card', () => {
    // A 200px-wide card, so x < 100 is its left half.
    function deckCard(container: HTMLElement, id: string) {
      const element = container.querySelector(`[data-deck-card-id="${id}"]`) as HTMLElement
      element.getBoundingClientRect = () => new DOMRect(0, 0, 200, 266)
      return element
    }

    function planCard(container: HTMLElement, id: string) {
      const element = container.querySelector(`[data-card-id="${id}"]`) as HTMLElement
      element.getBoundingClientRect = () => new DOMRect(0, 0, 200, 266)
      return element
    }

    describe('with a mouse', () => {
      beforeEach(() => {
        vi.spyOn(window, 'matchMedia').mockImplementation(
          (query) => ({ matches: query === '(hover: hover)', media: query }) as MediaQueryList,
        )
      })

      afterEach(() => vi.restoreAllMocks())

      /** @see docs/card-notes.md § "Clicking a side of the card" */
      it('adds a card to the plan from its left half, and discards it from there too', async () => {
        const { container } = renderBuilder()

        fireEvent.click(deckCard(container, 'hike'), { clientX: 40 })
        expect(await screen.findByRole('button', { name: 'Discard: Hike' })).toBeInTheDocument()

        fireEvent.click(planCard(container, 'hike'), { clientX: 40 })
        expect(await screen.findByRole('button', { name: 'Add to plan: Hike' })).toBeInTheDocument()
        expect(keptPicks()).toBeNull()
      })

      /** @see docs/card-notes.md § "Clicking a side of the card" */
      it('opens the notes from its right half', async () => {
        const { container } = renderBuilder()

        fireEvent.click(deckCard(container, 'museum'), { clientX: 160 })
        expect(await screen.findByRole('dialog', { name: 'Museum' })).toBeInTheDocument()
        expect(keptPicks()).toBeNull()
      })

      /** @see docs/card-notes.md § "Clicking a side of the card" - a link in the description is followed instead */
      it('leaves a click on a link in the description to the link', () => {
        renderBuilder()

        fireEvent.click(screen.getByRole('link', { name: 'the gallery' }), { clientX: 40 })
        expect(screen.queryByRole('button', { name: 'Discard: Museum' })).not.toBeInTheDocument()
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })

      /** @see docs/card-notes.md § "Clicking a side of the card" - the side under the mouse is bold */
      it('marks the side the mouse is over, but not over a link', () => {
        const { container } = renderBuilder()
        const card = deckCard(container, 'museum')

        fireEvent.pointerMove(card, { clientX: 40, pointerType: 'mouse' })
        expect(card).toHaveAttribute('data-side', 'primary')
        fireEvent.pointerMove(card, { clientX: 160, pointerType: 'mouse' })
        expect(card).toHaveAttribute('data-side', 'notes')
        fireEvent.pointerMove(screen.getByRole('link', { name: 'the gallery' }), { clientX: 40, pointerType: 'mouse' })
        expect(card).not.toHaveAttribute('data-side')

        fireEvent.pointerMove(card, { clientX: 40, pointerType: 'mouse' })
        fireEvent.pointerLeave(card, { pointerType: 'mouse' })
        expect(card).not.toHaveAttribute('data-side')
      })
    })

    /** @see docs/card-notes.md § "When the options show" - on a touch screen */
    describe('on a touch screen', () => {
      it("doesn't add a card to the plan on the first tap, only shows its options", async () => {
        const { container } = renderBuilder()

        fireEvent.click(deckCard(container, 'museum'), { clientX: 40 })
        expect(container.querySelector('[data-deck-card-id="museum"]')).toHaveAttribute('data-revealed', 'true')
        expect(screen.queryByRole('button', { name: 'Discard: Museum' })).not.toBeInTheDocument()
        expect(keptPicks()).toBeNull()
      })

      it('does the option on the side tapped once the options are showing', async () => {
        const { container } = renderBuilder()

        fireEvent.click(deckCard(container, 'museum'), { clientX: 160 })
        fireEvent.click(deckCard(container, 'museum'), { clientX: 160 })
        expect(await screen.findByRole('dialog', { name: 'Museum' })).toBeInTheDocument()
      })

      it('needs a fresh tap on a card after tapping somewhere else', async () => {
        const { container } = renderBuilder()

        fireEvent.click(deckCard(container, 'museum'), { clientX: 40 })
        fireEvent.pointerDown(document.body)
        expect(container.querySelector('[data-deck-card-id="museum"]')).toHaveAttribute('data-revealed', 'false')

        fireEvent.click(deckCard(container, 'museum'), { clientX: 40 })
        expect(screen.queryByRole('button', { name: 'Discard: Museum' })).not.toBeInTheDocument()
      })
    })
  })

  /** @see docs/deck-sorting.md § "Sort options" */
  describe('sorting', () => {
    function deckOrder(container: HTMLElement) {
      return [...container.querySelectorAll('[data-deck-card-id]')].map((card) =>
        card.getAttribute('data-deck-card-id'),
      )
    }

    it('starts on Random', () => {
      renderBuilder()
      const sorts = screen.getByRole('group', { name: 'Sort ideas' })
      expect(within(sorts).getByRole('button', { name: 'Random' })).toHaveAttribute('aria-pressed', 'true')
    })

    it('puts the newest ideas first for Date added', async () => {
      const user = userEvent.setup()
      const { container } = renderBuilder()

      await user.click(screen.getByRole('button', { name: 'Date added' }))
      expect(screen.getByRole('button', { name: 'Date added' })).toHaveAttribute('aria-pressed', 'true')
      expect(deckOrder(container)).toEqual(['hike', 'museum', 'picnic'])
    })

    it('puts the highest rated ideas first for Interest', async () => {
      const user = userEvent.setup()
      const { container } = render(
        <DeckBuilder
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
      const user = userEvent.setup()
      const { container } = renderBuilder()

      await user.click(screen.getByRole('button', { name: 'Interest' }))
      await user.click(screen.getByRole('button', { name: 'Notes on Museum' }))
      const notes = await screen.findByRole('dialog', { name: 'Museum' })
      await user.click(within(notes).getByRole('radio', { name: '5 stars' }))
      await waitFor(() => expect(deckOrder(container)[0]).toBe('museum'))
    })

    /** @see docs/deck-sorting.md § "How it fits with filters and the plan" */
    it('sorts only the ideas the filters show', async () => {
      const user = userEvent.setup()
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
      render(<DeckBuilder deckName="Test deck" shareId="share123" cards={cards} seed={1} initialSort="added" />)
      expect(screen.getByRole('button', { name: 'Date added' })).toHaveAttribute('aria-pressed', 'true')
    })

    it('saves a new pick for a signed-in visitor', async () => {
      const user = userEvent.setup()
      render(<DeckBuilder deckName="Test deck" shareId="share123" cards={cards} seed={1} remembersSort />)

      await user.click(screen.getByRole('button', { name: 'Interest' }))
      expect(saveDeckSort).toHaveBeenCalledExactlyOnceWith('interest')
      await user.click(screen.getByRole('button', { name: 'Interest' }))
      expect(saveDeckSort).toHaveBeenCalledOnce()
    })

    it('saves nothing for someone signed out', async () => {
      const user = userEvent.setup()
      renderBuilder()

      await user.click(screen.getByRole('button', { name: 'Interest' }))
      expect(saveDeckSort).not.toHaveBeenCalled()
    })

    it('still sorts when saving fails', async () => {
      const user = userEvent.setup()
      saveDeckSort.mockRejectedValue(new Error('offline'))
      render(<DeckBuilder deckName="Test deck" shareId="share123" cards={cards} seed={1} remembersSort />)

      await user.click(screen.getByRole('button', { name: 'Date added' }))
      expect(screen.getByRole('button', { name: 'Date added' })).toHaveAttribute('aria-pressed', 'true')
    })
  })

  describe('notes', () => {
    /** @see docs/card-notes.md § "Opening a card's notes" - the date the card was added */
    it('shows when the card was added', async () => {
      const user = userEvent.setup()
      const addedAt = '2026-03-14T10:00:00.000Z'
      render(<DeckBuilder deckName="Test deck" shareId="share123" cards={[{ ...cards[1], addedAt }]} seed={1} />)

      await user.click(screen.getByRole('button', { name: 'Notes on Museum' }))
      const notes = await screen.findByRole('dialog', { name: 'Museum' })
      const date = new Date(addedAt).toLocaleDateString(undefined, { dateStyle: 'long' })
      expect(within(notes).getByText(date)).toHaveAttribute('datetime', addedAt)
      expect(within(notes).getByText(/^Added/)).toHaveTextContent(`Added ${date}`)
    })

    /** @see docs/card-notes.md § "Card actions" - plan cards have Discard and Notes */
    it('opens the notes of a card in the plan', async () => {
      const user = userEvent.setup()
      renderBuilder()

      await user.click(screen.getByRole('button', { name: 'Add to plan: Picnic' }))
      const plan = screen.getByRole('region', { name: 'Your plan' })
      await user.click(within(plan).getByRole('button', { name: 'Notes on Picnic' }))
      const notes = await screen.findByRole('dialog', { name: 'Picnic' })
      expect(within(notes).getByRole('textbox', { name: 'Notes' })).toHaveValue('Bring a rug')
      // Still in the plan.
      expect(screen.getByRole('button', { name: 'Discard: Picnic', hidden: true })).toBeInTheDocument()
    })

    /** @see docs/card-notes.md § "Opening a card's notes" */
    it('opens a card to five empty stars and a notes box', async () => {
      const user = userEvent.setup()
      renderBuilder()

      await user.click(screen.getByRole('button', { name: 'Notes on Museum' }))
      const notes = await screen.findByRole('dialog', { name: 'Museum' })
      const stars = within(notes).getByRole('group', { name: 'How keen are you?' })
      expect(within(stars).getAllByRole('radio')).toHaveLength(5)
      for (const star of within(stars).getAllByRole('radio')) expect(star).not.toBeChecked()
      expect(within(notes).getByRole('textbox', { name: 'Notes' })).toHaveValue('')
    })

    /** @see docs/card-notes.md § "Rating and notes" */
    it("shows the card's saved rating and notes", async () => {
      const user = userEvent.setup()
      renderBuilder()

      await user.click(screen.getByRole('button', { name: 'Notes on Picnic' }))
      const notes = await screen.findByRole('dialog', { name: 'Picnic' })
      expect(within(notes).getByRole('radio', { name: '2 stars' })).toBeChecked()
      expect(within(notes).getByRole('textbox', { name: 'Notes' })).toHaveValue('Bring a rug')
    })

    /** @see docs/card-notes.md § "Rating and notes on the card" */
    it('jots the rating and notes in the corner of the card, and follows changes', async () => {
      const user = userEvent.setup()
      const { container } = renderBuilder()
      const deckCard = (id: string) => container.querySelector(`[data-deck-card-id="${id}"]`) as HTMLElement

      expect(within(deckCard('picnic')).getByText('Rated 2 out of 5. Has notes.')).toBeInTheDocument()
      expect(within(deckCard('museum')).queryByText(/Rated|Has notes/)).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Notes on Museum' }))
      const notes = await screen.findByRole('dialog', { name: 'Museum' })
      await user.click(within(notes).getByRole('radio', { name: '4 stars' }))
      await user.click(within(notes).getByRole('button', { name: 'Done' }))
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Museum' })).not.toBeInTheDocument())
      expect(within(deckCard('museum')).getByText('Rated 4 out of 5.')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Add to plan: Picnic' }))
      const plan = screen.getByRole('region', { name: 'Your plan' })
      expect(within(plan).getByText('Rated 2 out of 5. Has notes.')).toBeInTheDocument()
    })

    /** @see docs/card-notes.md § "Saving" - a rating saves as soon as a star is clicked */
    it('saves a rating straight away, and clears it when the same star is clicked again', async () => {
      const user = userEvent.setup()
      renderBuilder()

      await user.click(screen.getByRole('button', { name: 'Notes on Museum' }))
      const notes = await screen.findByRole('dialog', { name: 'Museum' })
      await user.click(within(notes).getByRole('radio', { name: '4 stars' }))
      expect(saveCardNotes).toHaveBeenLastCalledWith('share123', 'museum', { interest: 4, notes: '' })
      expect(within(notes).getByRole('radio', { name: '4 stars' })).toBeChecked()

      await user.click(within(notes).getByRole('radio', { name: '4 stars' }))
      expect(saveCardNotes).toHaveBeenLastCalledWith('share123', 'museum', { interest: null, notes: '' })
      expect(await within(notes).findByRole('status')).toHaveTextContent('Saved')
    })

    /** @see docs/card-notes.md § "Saving" - notes save once typing stops */
    it('saves notes once typing stops, as one save', async () => {
      const user = userEvent.setup()
      renderBuilder()

      await user.click(screen.getByRole('button', { name: 'Notes on Museum' }))
      const notes = await screen.findByRole('dialog', { name: 'Museum' })
      await user.type(within(notes).getByRole('textbox', { name: 'Notes' }), 'Free on Sundays')
      expect(saveCardNotes).not.toHaveBeenCalled()

      await waitFor(() => expect(saveCardNotes).toHaveBeenCalledTimes(1), { timeout: 2000 })
      expect(saveCardNotes).toHaveBeenCalledWith('share123', 'museum', { interest: null, notes: 'Free on Sundays' })
    })

    /** @see docs/card-notes.md § "Saving" - notes also save when closed */
    it('saves unsaved notes on Done, and keeps them for next time', async () => {
      const user = userEvent.setup()
      renderBuilder()

      await user.click(screen.getByRole('button', { name: 'Notes on Hike' }))
      let notes = await screen.findByRole('dialog', { name: 'Hike' })
      await user.type(within(notes).getByRole('textbox', { name: 'Notes' }), 'Early start')
      await user.click(within(notes).getByRole('button', { name: 'Done' }))
      expect(saveCardNotes).toHaveBeenCalledWith('share123', 'hike', { interest: null, notes: 'Early start' })
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Hike' })).not.toBeInTheDocument())

      await user.click(screen.getByRole('button', { name: 'Notes on Hike' }))
      notes = await screen.findByRole('dialog', { name: 'Hike' })
      expect(within(notes).getByRole('textbox', { name: 'Notes' })).toHaveValue('Early start')
    })

    /** @see docs/card-notes.md § "Saving" - if a save fails, it shows why */
    it('shows why notes could not be saved', async () => {
      saveCardNotes.mockResolvedValue({ ok: false, error: 'Card not found' })
      const user = userEvent.setup()
      renderBuilder()

      await user.click(screen.getByRole('button', { name: 'Notes on Museum' }))
      const notes = await screen.findByRole('dialog', { name: 'Museum' })
      await user.click(within(notes).getByRole('radio', { name: '3 stars' }))
      expect(await within(notes).findByRole('alert')).toHaveTextContent('Card not found')
    })
  })

  /** @see docs/card-notes.md § "Editing a card" */
  describe('editing the deck', () => {
    function renderForEditor(deckCards = cards, seed = 1) {
      return <DeckBuilder deckName="Test deck" shareId="share123" cards={deckCards} seed={seed} deckId="deck1" />
    }

    function deckOrder(container: HTMLElement) {
      return [...container.querySelectorAll('[data-deck-card-id]')].map((card) =>
        card.getAttribute('data-deck-card-id'),
      )
    }

    beforeEach(() => {
      for (const action of Object.values(deckActions)) {
        action.mockReset()
        action.mockResolvedValue({ ok: true, data: undefined })
      }
    })

    afterEach(() => vi.restoreAllMocks())

    it("gives no way to edit to someone who can't", () => {
      renderBuilder()
      expect(screen.queryByRole('button', { name: 'Edit Picnic' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Add an idea' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Quick Add' })).not.toBeInTheDocument()
    })

    it("opens a card's edit form from its edit button, without adding it to the plan", async () => {
      vi.spyOn(window, 'matchMedia').mockImplementation(
        (query) => ({ matches: query === '(hover: hover)', media: query }) as MediaQueryList,
      )
      const user = userEvent.setup()
      render(renderForEditor())

      await user.click(screen.getByRole('button', { name: 'Edit Picnic' }))
      const form = await screen.findByRole('dialog', { name: 'Edit idea' })
      expect(within(form).getByRole('textbox', { name: /^Title/ })).toHaveValue('Picnic')
      expect(screen.getByRole('button', { name: 'Add to plan: Picnic' })).toBeInTheDocument()
      expect(keptPicks()).toBeNull()

      await user.clear(within(form).getByRole('textbox', { name: /^Title/ }))
      await user.type(within(form).getByRole('textbox', { name: /^Title/ }), 'Picnic by the river')
      await user.click(within(form).getByRole('button', { name: 'Save' }))
      expect(deckActions.saveCard).toHaveBeenCalledWith('deck1', 'picnic', {
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
      const user = userEvent.setup()
      deckActions.quickAddCard.mockResolvedValue({
        ok: true,
        data: { title: 'Golf', description: '', tags: [], date: '' },
      })
      const { container } = render(renderForEditor())
      const grid = container.querySelector('.card-grid') as HTMLElement
      expect(grid.lastElementChild).toContainElement(screen.getByRole('button', { name: 'Add an idea' }))

      await user.click(screen.getByRole('button', { name: 'Add an idea' }))
      expect(await screen.findByRole('heading', { name: 'New idea' })).toBeInTheDocument()
      expect(screen.getByRole('textbox', { name: /^Title/ })).toHaveValue('')
      await user.click(screen.getByRole('button', { name: 'Cancel' }))

      await user.click(screen.getByRole('button', { name: 'Quick Add' }))
      await user.type(screen.getByRole('textbox', { name: /^Describe the idea/ }), 'Golf')
      await user.click(screen.getByRole('button', { name: 'Fill in the details' }))
      expect(deckActions.quickAddCard).toHaveBeenCalledWith('deck1', 'Golf')
      expect(await screen.findByRole('textbox', { name: /^Title/ })).toHaveValue('Golf')
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
      render(<DeckBuilder deckName="Test deck" shareId="share123" cards={cards} seed={1} editHref="/decks/deck1" />)
      expect(screen.getByRole('link', { name: 'Edit this deck' })).toHaveAttribute('href', '/decks/deck1')
      expect(screen.queryByRole('link', { name: 'Request edit access' })).not.toBeInTheDocument()
    })

    /** @see docs/deck-sharing.md § "Asking for edit access" - someone who has already asked sees that they have */
    it('says so once someone has asked to edit', () => {
      render(<DeckBuilder deckName="Test deck" shareId="share123" cards={cards} seed={1} access="pending" />)
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
        <DeckBuilder
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

    it("doesn't list plans to anyone else", () => {
      renderBuilder()
      expect(screen.queryByRole('region', { name: 'Plans' })).not.toBeInTheDocument()
    })

    it("doesn't link to making a deck", () => {
      renderBuilder()
      expect(screen.queryByRole('link', { name: /Make your own deck/ })).not.toBeInTheDocument()
    })
  })

  /** @see docs/deck-sorting.md § "How it fits with filters and the plan" */
  describe('sorting with the plan', () => {
    afterEach(() => vi.restoreAllMocks())

    it('keeps the plan in the order the cards were picked', async () => {
      const user = userEvent.setup()
      const { container } = renderBuilder()

      await user.click(screen.getByRole('button', { name: 'Add to plan: Picnic' }))
      await user.click(screen.getByRole('button', { name: 'Add to plan: Hike' }))
      await user.click(screen.getByRole('button', { name: 'Date added' }))
      await user.click(screen.getByRole('button', { name: 'Interest' }))
      const plan = [...container.querySelectorAll('[data-card-id]')].map((card) => card.getAttribute('data-card-id'))
      expect(plan).toEqual(['picnic', 'hike'])
    })

    it('only picks a random idea from the ones the filters show', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.99)
      const user = userEvent.setup()
      renderBuilder()

      await user.click(
        within(screen.getByRole('group', { name: 'Filter ideas by tag' })).getByRole('button', { name: 'culture' }),
      )
      await user.click(screen.getByRole('button', { name: 'select a random one' }))
      expect(await screen.findByRole('button', { name: 'Discard: Museum' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Discard: Picnic' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Discard: Hike' })).not.toBeInTheDocument()
    })
  })

  describe('reordering the plan', () => {
    function planOrder(container: HTMLElement) {
      return [...container.querySelectorAll('[data-card-id]')].map((card) => card.getAttribute('data-card-id'))
    }

    /** @see docs/card-layout.md § "Reordering the plan" - by its grip */
    it('gives cards in the plan a grip, and cards in the deck none', async () => {
      keepPicks(['museum'])
      renderBuilder()
      expect(await screen.findByRole('button', { name: 'Move Museum' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Move Picnic' })).not.toBeInTheDocument()
    })

    /** @see docs/card-layout.md § "Reordering the plan" - from the keyboard, and kept in the browser */
    it('moves a card along the plan with the arrow keys on its grip', async () => {
      keepPicks(['picnic', 'museum', 'hike'])
      const user = userEvent.setup()
      const { container } = renderBuilder()
      const grip = await screen.findByRole('button', { name: 'Move Picnic' })

      grip.focus()
      await user.keyboard('{ArrowRight}')
      expect(planOrder(container)).toEqual(['museum', 'picnic', 'hike'])
      expect(keptPicks()).toEqual(['museum', 'picnic', 'hike'])
      expect(screen.getByRole('button', { name: 'Move Picnic' })).toHaveFocus()

      await user.keyboard('{ArrowRight}{ArrowRight}')
      expect(planOrder(container)).toEqual(['museum', 'hike', 'picnic'])

      await user.keyboard('{ArrowLeft}')
      expect(planOrder(container)).toEqual(['museum', 'picnic', 'hike'])
    })

    /** @see docs/card-layout.md § "Reordering the plan" - the new order is the one that's shared */
    it('saves the plan in its new order', async () => {
      savePlan.mockResolvedValue({ ok: true, data: { planId: 'plan42' } })
      keepPicks(['picnic', 'hike'])
      const user = userEvent.setup()
      renderBuilder()

      const grip = await screen.findByRole('button', { name: 'Move Hike' })
      grip.focus()
      await user.keyboard('{ArrowLeft}')
      await user.click(screen.getByRole('button', { name: 'Done' }))
      expect(savePlan).toHaveBeenCalledWith('share123', ['hike', 'picnic'])
    })

    describe('with a mouse', () => {
      beforeEach(() => {
        vi.spyOn(window, 'matchMedia').mockImplementation(
          (query) => ({ matches: query === '(hover: hover)', media: query }) as MediaQueryList,
        )
      })

      afterEach(() => vi.restoreAllMocks())

      /** @see docs/card-layout.md § "Reordering the plan" - not a click */
      it("doesn't discard the card or open its notes when the grip is pressed", async () => {
        keepPicks(['museum'])
        const user = userEvent.setup()
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
  })

  it('empties the plan with Clear plan', async () => {
    const user = userEvent.setup()
    renderBuilder()

    await user.click(screen.getByRole('button', { name: 'Add to plan: Picnic' }))
    await user.click(screen.getByRole('button', { name: 'Add to plan: Hike' }))
    await user.click(screen.getByRole('button', { name: 'Clear plan' }))

    expect(await screen.findByRole('button', { name: 'Add to plan: Picnic' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Add to plan: Hike' })).toBeInTheDocument()
    expect(keptPicks()).toBeNull()
  })

  describe('filtering by several tags', () => {
    function filterButton(name: string) {
      return within(screen.getByRole('group', { name: 'Filter ideas by tag' })).getByRole('button', { name })
    }

    it('shows only the ideas with every selected tag', async () => {
      const user = userEvent.setup()
      renderBuilder()

      await user.click(filterButton('outside'))
      await user.click(filterButton('active'))
      expect(screen.getByRole('button', { name: 'Add to plan: Hike' })).toBeInTheDocument()
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Add to plan: Picnic' })).not.toBeInTheDocument())
      expect(screen.queryByRole('button', { name: 'Add to plan: Museum' })).not.toBeInTheDocument()
    })

    it('says when no idea has every tag, and can show them all again', async () => {
      const user = userEvent.setup()
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
      const user = userEvent.setup()
      renderBuilder()

      await user.click(filterButton('culture'))
      await user.click(filterButton('All'))
      for (const card of cards)
        expect(await screen.findByRole('button', { name: `Add to plan: ${card.title}` })).toBeInTheDocument()
      expect(filterButton('culture')).toHaveAttribute('aria-pressed', 'false')
    })
  })

  /** @see docs/plans.md § "Sharing a plan" */
  describe('sharing the plan', () => {
    it("has no share dialog of its own; the plan's page shares it", async () => {
      savePlan.mockResolvedValue({ ok: true, data: { planId: 'plan42' } })
      const share = vi.fn()
      Object.defineProperty(navigator, 'share', { value: share, configurable: true })
      const user = userEvent.setup()
      renderBuilder()

      await user.click(screen.getByRole('button', { name: 'Add to plan: Hike' }))
      await user.click(screen.getByRole('button', { name: 'Done' }))
      await waitFor(() => expect(router.push).toHaveBeenCalled())
      expect(share).not.toHaveBeenCalled()
      expect(screen.queryByRole('button', { name: 'Copy link', hidden: true })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'Open your plan', hidden: true })).not.toBeInTheDocument()
    })

    it("says the plan couldn't be saved when the server can't be reached, and stays put", async () => {
      savePlan.mockRejectedValue(new Error('Failed to fetch'))
      const user = userEvent.setup()
      renderBuilder()

      await user.click(screen.getByRole('button', { name: 'Add to plan: Hike' }))
      await user.click(screen.getByRole('button', { name: 'Done' }))
      expect(await screen.findByRole('alert')).toHaveTextContent(
        "Couldn't save your plan. Check your connection and try again.",
      )
      expect(router.push).not.toHaveBeenCalled()
      expect(screen.getByRole('button', { name: 'Done' })).toBeEnabled()
    })
  })

  /** @see docs/plans.md § "Editing a plan" */
  describe('editing a saved plan', () => {
    const planPicks = 'build-a-date:picks:plan:plan42'

    function renderEditor() {
      return render(
        <DeckBuilder
          deckName="Test deck"
          shareId="share123"
          cards={cards}
          seed={1}
          plan={{ id: 'plan42', cardIds: ['hike', 'picnic'] }}
        />,
      )
    }

    function planOrder(container: HTMLElement) {
      return [...container.querySelectorAll('[data-card-id]')].map((card) => card.getAttribute('data-card-id'))
    }

    beforeEach(() => {
      updatePlan.mockResolvedValue({ ok: true, data: { planId: 'plan42' } })
    })

    it("starts with the plan's cards in the plan, in its order", () => {
      const { container } = renderEditor()
      expect(planOrder(container)).toEqual(['hike', 'picnic'])
      expect(screen.getByText('Editing a plan')).toBeInTheDocument()
    })

    it('saves over the same plan when Update Plan is pressed', async () => {
      const user = userEvent.setup()
      renderEditor()

      await user.click(screen.getByRole('button', { name: 'Add to plan: Museum' }))
      await user.click(screen.getByRole('button', { name: 'Update Plan' }))
      expect(updatePlan).toHaveBeenCalledWith('plan42', ['hike', 'picnic', 'museum'])
      expect(savePlan).not.toHaveBeenCalled()
      await waitFor(() => expect(router.push).toHaveBeenCalledWith('/p/plan42?share'))
    })

    it('goes to the plan, ready to share, without saving when nothing has changed', async () => {
      const user = userEvent.setup()
      renderEditor()

      await user.click(screen.getByRole('button', { name: 'Update Plan' }))
      expect(router.push).toHaveBeenCalledWith('/p/plan42?share')
      expect(updatePlan).not.toHaveBeenCalled()
    })

    it('shows why the plan could not be saved', async () => {
      updatePlan.mockResolvedValue({ ok: false, error: 'Plan not found' })
      const user = userEvent.setup()
      renderEditor()

      await user.click(screen.getByRole('button', { name: 'Discard: Hike' }))
      await user.click(screen.getByRole('button', { name: 'Update Plan' }))
      expect(await screen.findByRole('alert')).toHaveTextContent('Plan not found')
    })

    /** @see docs/plans.md § "Picks are kept in the browser" - one set per plan being edited */
    it("keeps unsaved changes for that plan, apart from the deck's own picks", async () => {
      keepPicks(['museum'])
      const user = userEvent.setup()
      const { container } = renderEditor()
      expect(planOrder(container)).toEqual(['hike', 'picnic'])
      expect(keptPicks(planPicks)).toBeNull()

      await user.click(screen.getByRole('button', { name: 'Discard: Hike' }))
      expect(keptPicks(planPicks)).toEqual(['picnic'])
      expect(keptPicks()).toEqual(['museum'])
    })

    /** @see docs/plans.md § "Picks are kept in the browser" - changes to a saved plan survive a reload, not the tab */
    it('keeps unsaved changes to the plan for this tab only', async () => {
      const user = userEvent.setup()
      renderEditor()

      await user.click(screen.getByRole('button', { name: 'Discard: Hike' }))
      expect(JSON.parse(sessionStorage.getItem(planPicks) ?? 'null')).toEqual(['picnic'])
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
      const user = userEvent.setup()
      renderEditor()

      await user.click(screen.getByRole('button', { name: 'Discard: Hike' }))
      expect(keptPicks(planPicks)).toEqual(['picnic'])
      await user.click(screen.getByRole('button', { name: 'Update Plan' }))
      await waitFor(() => expect(keptPicks(planPicks)).toBeNull())
    })

    it('keeps an emptied plan as empty, rather than going back to the saved one', async () => {
      const user = userEvent.setup()
      renderEditor()

      await user.click(screen.getByRole('button', { name: 'Clear plan' }))
      expect(keptPicks(planPicks)).toEqual([])
      // Nothing to save, but still a way out.
      expect(screen.getByRole('button', { name: 'Update Plan' })).toBeDisabled()
      expect(screen.getByRole('link', { name: 'Cancel' })).toBeInTheDocument()
    })

    it('says Update Plan rather than Done', () => {
      renderEditor()
      expect(screen.getByRole('button', { name: 'Update Plan' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument()
    })

    it('goes back to the plan on Cancel, dropping the unsaved changes', async () => {
      const user = userEvent.setup()
      renderEditor()

      await user.click(screen.getByRole('button', { name: 'Discard: Hike' }))
      expect(keptPicks(planPicks)).toEqual(['picnic'])
      const cancel = screen.getByRole('link', { name: 'Cancel' })
      expect(cancel).toHaveAttribute('href', '/p/plan42')
      await user.click(cancel)
      expect(keptPicks(planPicks)).toBeNull()
      expect(updatePlan).not.toHaveBeenCalled()
    })
  })
})
