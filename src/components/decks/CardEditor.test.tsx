/** @vitest-environment jsdom */
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DateCard } from '@/types'
import CardEditor from './CardEditor'

const { saveCard, deleteCard } = vi.hoisted(() => ({ saveCard: vi.fn(), deleteCard: vi.fn() }))
vi.mock('@/lib/actions/decks', () => ({ saveCard, deleteCard }))

const picnic: DateCard = {
  id: 'picnic',
  title: 'Picnic',
  description: 'In the park',
  tags: ['outside', 'cheap'],
  date: 'Weekends',
}

function renderEditor(card: DateCard | null | undefined, onClose = vi.fn()) {
  render(<CardEditor deckId="deck1" card={card} deckTags={['cheap', 'culture', 'outside']} onClose={onClose} />)
  return { onClose }
}

function field(name: RegExp) {
  return screen.getByRole('textbox', { name })
}

beforeEach(() => {
  saveCard.mockReset()
  deleteCard.mockReset()
  saveCard.mockResolvedValue({ ok: true, data: undefined })
  deleteCard.mockResolvedValue({ ok: true, data: undefined })
})

afterEach(() => vi.restoreAllMocks())

describe('CardEditor', () => {
  it('stays closed without a card', () => {
    renderEditor(undefined)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens empty for a new card', () => {
    renderEditor(null)
    expect(screen.getByRole('heading', { name: 'New idea' })).toBeInTheDocument()
    expect(field(/^Title/)).toHaveValue('')
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
  })

  it("opens with an existing card's values", () => {
    renderEditor(picnic)
    expect(screen.getByRole('heading', { name: 'Edit idea' })).toBeInTheDocument()
    expect(field(/^Title/)).toHaveValue('Picnic')
    expect(field(/^Description/)).toHaveValue('In the park')
    expect(field(/^When/)).toHaveValue('Weekends')
    expect(field(/^Tags/)).toHaveValue('outside, cheap')
  })

  it('saves the card with its tags tidied up, then closes', async () => {
    const user = userEvent.setup()
    const { onClose } = renderEditor(null)

    await user.type(field(/^Title/), 'Museum')
    await user.type(field(/^Description/), 'See the gallery')
    await user.type(field(/^When/), 'Sundays')
    await user.type(field(/^Tags/), ' Culture, , Indoors ,')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(saveCard).toHaveBeenCalledWith('deck1', null, {
      title: 'Museum',
      description: 'See the gallery',
      tags: ['culture', 'indoors'],
      date: 'Sundays',
    })
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('saves changes to an existing card under its id', async () => {
    const user = userEvent.setup()
    renderEditor(picnic)

    await user.clear(field(/^Title/))
    await user.type(field(/^Title/), 'Beach picnic')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(saveCard).toHaveBeenCalledWith('deck1', 'picnic', {
      title: 'Beach picnic',
      description: 'In the park',
      tags: ['outside', 'cheap'],
      date: 'Weekends',
    })
  })

  it('shows why a card could not be saved and stays open', async () => {
    saveCard.mockResolvedValue({ ok: false, error: 'Title is too long' })
    const user = userEvent.setup()
    const { onClose } = renderEditor(picnic)

    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Title is too long')
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('adds and removes deck tags from the picker', async () => {
    const user = userEvent.setup()
    renderEditor(picnic)
    const picker = screen.getByRole('group', { name: 'Tags used in this deck' })

    expect(within(picker).getByRole('button', { name: 'culture' })).toHaveAttribute('aria-pressed', 'false')
    await user.click(within(picker).getByRole('button', { name: 'culture' }))
    expect(field(/^Tags/)).toHaveValue('outside, cheap, culture')
    expect(within(picker).getByRole('button', { name: 'culture' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(within(picker).getByRole('button', { name: 'outside' }))
    expect(field(/^Tags/)).toHaveValue('cheap, culture')
    expect(within(picker).getByRole('button', { name: 'outside' })).toHaveAttribute('aria-pressed', 'false')
  })

  describe('deleting', () => {
    it('asks first, and keeps the card if the answer is no', async () => {
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
      const user = userEvent.setup()
      const { onClose } = renderEditor(picnic)

      await user.click(screen.getByRole('button', { name: 'Delete' }))
      expect(confirm).toHaveBeenCalledWith('Delete "Picnic"?')
      expect(deleteCard).not.toHaveBeenCalled()
      expect(onClose).not.toHaveBeenCalled()
    })

    it('deletes the card and closes once confirmed', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      const user = userEvent.setup()
      const { onClose } = renderEditor(picnic)

      await user.click(screen.getByRole('button', { name: 'Delete' }))
      expect(deleteCard).toHaveBeenCalledWith('deck1', 'picnic')
      await waitFor(() => expect(onClose).toHaveBeenCalled())
    })
  })

  it('closes without saving on Cancel', async () => {
    const user = userEvent.setup()
    const { onClose } = renderEditor(picnic)

    await user.type(field(/^Title/), ' by the lake')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalled()
    expect(saveCard).not.toHaveBeenCalled()
  })
})
