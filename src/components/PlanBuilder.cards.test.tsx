/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mediaMatching } from '@/test/media'
import {
  cards,
  deckCard,
  keptPicks,
  planCard,
  renderBuilder,
  resetPlanBuilder,
  saveCardNotes,
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
  describe('clicking a side of a card', () => {
    describe('with a mouse', () => {
      beforeEach(() => {
        vi.spyOn(window, 'matchMedia').mockImplementation(mediaMatching('(hover: hover)'))
      })

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

      it('adds the card to the plan from a tap on its left side once the options are showing', async () => {
        const { container } = renderBuilder()

        fireEvent.click(deckCard(container, 'museum'), { clientX: 40 })
        fireEvent.click(deckCard(container, 'museum'), { clientX: 40 })
        expect(await screen.findByRole('button', { name: 'Discard: Museum' })).toBeInTheDocument()
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
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

  describe('notes', () => {
    /** @see docs/card-notes.md § "Opening a card's notes" - the date the card was added */
    it('shows when the card was added', async () => {
      const user = userEvent.setup({ delay: null })
      const addedAt = '2026-03-14T10:00:00.000Z'
      render(<PlanBuilder deckName="Test deck" shareId="share123" cards={[{ ...cards[1], addedAt }]} seed={1} />)

      await user.click(screen.getByRole('button', { name: 'Notes on Museum' }))
      const notes = await screen.findByRole('dialog', { name: 'Museum' })
      const date = new Date(addedAt).toLocaleDateString(undefined, { dateStyle: 'long' })
      expect(within(notes).getByText(date)).toHaveAttribute('datetime', addedAt)
      expect(within(notes).getByText(/^Added/)).toHaveTextContent(`Added ${date}`)
    })

    /** @see docs/card-notes.md § "Card actions" - plan cards have Discard and Notes */
    it('opens the notes of a card in the plan', async () => {
      const user = userEvent.setup({ delay: null })
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
      const user = userEvent.setup({ delay: null })
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
      const user = userEvent.setup({ delay: null })
      renderBuilder()

      await user.click(screen.getByRole('button', { name: 'Notes on Picnic' }))
      const notes = await screen.findByRole('dialog', { name: 'Picnic' })
      expect(within(notes).getByRole('radio', { name: '2 stars' })).toBeChecked()
      expect(within(notes).getByRole('textbox', { name: 'Notes' })).toHaveValue('Bring a rug')
    })

    /** @see docs/card-notes.md § "Rating and notes on the card" */
    it('jots the rating and notes in the corner of the card, and follows changes', async () => {
      const user = userEvent.setup({ delay: null })
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
      const user = userEvent.setup({ delay: null })
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

    /** @see docs/card-notes.md § "Saving" - notes also save when closed */
    it('saves unsaved notes on Done, and keeps them for next time', async () => {
      const user = userEvent.setup({ delay: null })
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
      const user = userEvent.setup({ delay: null })
      renderBuilder()

      await user.click(screen.getByRole('button', { name: 'Notes on Museum' }))
      const notes = await screen.findByRole('dialog', { name: 'Museum' })
      await user.click(within(notes).getByRole('radio', { name: '3 stars' }))
      expect(await within(notes).findByRole('alert')).toHaveTextContent('Card not found')
    })
  })
})
