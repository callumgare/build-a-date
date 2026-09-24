/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DateCard } from '@/types'
import DeckBuilder from './DeckBuilder'

const { savePlan, saveCardNotes } = vi.hoisted(() => ({ savePlan: vi.fn(), saveCardNotes: vi.fn() }))
vi.mock('@/lib/actions/plans', () => ({ savePlan, saveCardNotes }))
vi.mock('next/link', () => ({ default: (props: object) => <a {...props} /> }))

const cards: DateCard[] = [
  { id: 'picnic', title: 'Picnic', description: '', tags: ['outside'], interest: 2, notes: 'Bring a rug' },
  { id: 'museum', title: 'Museum', description: 'See [the gallery](https://example.com)', tags: ['culture'] },
  { id: 'hike', title: 'Hike', description: '', tags: ['outside', 'active'] },
]

function renderBuilder() {
  return render(<DeckBuilder deckName="Test deck" shareId="share123" cards={cards} seed={1} />)
}

beforeEach(() => {
  savePlan.mockReset()
  saveCardNotes.mockReset()
  saveCardNotes.mockResolvedValue({ ok: true, data: undefined })
  window.location.hash = ''
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
    expect(window.location.hash).toBe('#picnic')

    await user.click(screen.getByRole('button', { name: 'Discard: Picnic' }))
    expect(await screen.findByRole('button', { name: 'Add to plan: Picnic' })).toBeInTheDocument()
  })

  it('restores picks from the URL hash', async () => {
    window.location.hash = '#museum,not-a-card'
    renderBuilder()
    expect(await screen.findByRole('button', { name: 'Discard: Museum' })).toBeInTheDocument()
  })

  it('filters the deck by tag', async () => {
    const user = userEvent.setup()
    renderBuilder()
    const filters = screen.getByRole('group', { name: 'Filter ideas by tag' })

    await user.click(within(filters).getByRole('button', { name: 'culture' }))
    expect(await screen.findByRole('button', { name: 'Add to plan: Museum' })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Add to plan: Picnic' })).not.toBeInTheDocument())
  })

  it('saves the plan when Done is pressed and offers its link', async () => {
    savePlan.mockResolvedValue({ ok: true, data: { planId: 'plan42' } })
    const user = userEvent.setup()
    renderBuilder()

    await user.click(screen.getByRole('button', { name: 'Add to plan: Hike' }))
    await user.click(screen.getByRole('button', { name: 'Add to plan: Museum' }))
    await user.click(screen.getByRole('button', { name: 'Done' }))

    expect(savePlan).toHaveBeenCalledWith('share123', ['hike', 'museum'])
    expect(await screen.findByRole('link', { name: 'Open your plan' })).toHaveAttribute(
      'href',
      `${window.location.origin}/p/plan42`,
    )

    // The same plan shares the same link rather than saving again.
    await user.click(screen.getByRole('button', { name: 'Done', hidden: true }))
    expect(savePlan).toHaveBeenCalledTimes(1)
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
        expect(window.location.hash).toBe('')
      })

      /** @see docs/card-notes.md § "Clicking a side of the card" */
      it('opens the notes from its right half', async () => {
        const { container } = renderBuilder()

        fireEvent.click(deckCard(container, 'museum'), { clientX: 160 })
        expect(await screen.findByRole('dialog', { name: 'Museum' })).toBeInTheDocument()
        expect(window.location.hash).toBe('')
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
        expect(window.location.hash).toBe('')
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
})
