/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DateCard } from '@/types'
import PlanView from './PlanView'

const { saveCardNotes } = vi.hoisted(() => ({ saveCardNotes: vi.fn() }))
vi.mock('@/lib/actions/plans', () => ({ saveCardNotes }))
const deckActions = vi.hoisted(() => ({ saveCard: vi.fn(), deleteCard: vi.fn(), quickAddCard: vi.fn() }))
vi.mock('@/lib/actions/decks', () => deckActions)

const cards: DateCard[] = [
  { id: 'picnic', title: 'Picnic', description: '', tags: ['outside'], interest: 2, notes: 'Bring a rug' },
  { id: 'museum', title: 'Museum', description: 'See [the gallery](https://example.com)', tags: ['culture'] },
]

function planCard(container: HTMLElement, id: string) {
  const element = container.querySelector(`[data-card-id="${id}"]`) as HTMLElement
  element.getBoundingClientRect = () => new DOMRect(0, 0, 200, 266)
  return element
}

function withMouse() {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) => ({ matches: query === '(hover: hover)', media: query }) as MediaQueryList,
  )
}

beforeEach(() => {
  saveCardNotes.mockReset()
  saveCardNotes.mockResolvedValue({ ok: true, data: undefined })
})

afterEach(() => vi.restoreAllMocks())

describe('PlanView', () => {
  /** @see docs/card-notes.md § "Card actions" - on a plan, only Notes */
  it('offers only Notes on each card', () => {
    render(<PlanView shareId="share123" cards={cards} />)
    expect(screen.getByRole('button', { name: 'Notes on Picnic' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^(Discard|Add to plan)/ })).not.toBeInTheDocument()
  })

  /** @see docs/card-notes.md § "Rating and notes on the card" */
  it('jots the rating and notes in the corner of the card, and follows changes', async () => {
    const user = userEvent.setup()
    const { container } = render(<PlanView shareId="share123" cards={cards} />)
    expect(within(planCard(container, 'picnic')).getByText('Rated 2 out of 5. Has notes.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Notes on Museum' }))
    const notes = await screen.findByRole('dialog', { name: 'Museum' })
    await user.click(within(notes).getByRole('radio', { name: '4 stars' }))
    expect(saveCardNotes).toHaveBeenLastCalledWith('share123', 'museum', { interest: 4, notes: '' })
    await user.click(within(notes).getByRole('button', { name: 'Done' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Museum' })).not.toBeInTheDocument())
    expect(within(planCard(container, 'museum')).getByText('Rated 4 out of 5.')).toBeInTheDocument()
  })

  /** @see docs/card-notes.md § "Clicking a side of the card" - on a plan, anywhere opens the notes */
  describe('with a mouse', () => {
    beforeEach(withMouse)

    it.each([40, 160])('opens the notes from a click at x=%i', async (clientX) => {
      const { container } = render(<PlanView shareId="share123" cards={cards} />)
      fireEvent.click(planCard(container, 'picnic'), { clientX })
      const notes = await screen.findByRole('dialog', { name: 'Picnic' })
      expect(within(notes).getByRole('textbox', { name: 'Notes' })).toHaveValue('Bring a rug')
    })

    it('marks Notes wherever the mouse is, but not over a link', () => {
      const { container } = render(<PlanView shareId="share123" cards={cards} />)
      const card = planCard(container, 'museum')

      fireEvent.pointerMove(card, { clientX: 40, pointerType: 'mouse' })
      expect(card).toHaveAttribute('data-side', 'notes')
      fireEvent.pointerMove(screen.getByRole('link', { name: 'the gallery' }), { clientX: 40, pointerType: 'mouse' })
      expect(card).not.toHaveAttribute('data-side')
    })

    it('leaves a click on a link in the description to the link', () => {
      render(<PlanView shareId="share123" cards={cards} />)
      fireEvent.click(screen.getByRole('link', { name: 'the gallery' }), { clientX: 160 })
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  /** @see docs/card-notes.md § "When the options show" - on a touch screen */
  it('only shows the options on the first tap on a touch screen', async () => {
    const { container } = render(<PlanView shareId="share123" cards={cards} />)

    fireEvent.click(planCard(container, 'picnic'), { clientX: 160 })
    expect(planCard(container, 'picnic')).toHaveAttribute('data-revealed', 'true')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent.click(planCard(container, 'picnic'), { clientX: 160 })
    expect(await screen.findByRole('dialog', { name: 'Picnic' })).toBeInTheDocument()
  })

  /** @see docs/card-notes.md § "Editing a card" */
  describe('editing a card', () => {
    it("gives no way to edit to someone who can't", () => {
      render(<PlanView shareId="share123" cards={cards} />)
      expect(screen.queryByRole('button', { name: 'Edit Picnic' })).not.toBeInTheDocument()
    })

    it("opens a card's edit form from its edit button, without opening its notes", async () => {
      withMouse()
      const user = userEvent.setup()
      render(<PlanView shareId="share123" cards={cards} deckId="deck1" deckTags={['culture', 'outside']} />)

      await user.click(screen.getByRole('button', { name: 'Edit Picnic' }))
      const form = await screen.findByRole('dialog', { name: 'Edit idea' })
      expect(within(form).getByRole('textbox', { name: /^Title/ })).toHaveValue('Picnic')
      expect(screen.queryByRole('dialog', { name: 'Picnic' })).not.toBeInTheDocument()
    })
  })
})
