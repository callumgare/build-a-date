/** @vitest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DeckRole } from '@/lib/decks'
import type { DateCard } from '@/types'
import type { DeckPerson } from './DeckAccess'
import DeckEditor from './DeckEditor'

const actions = vi.hoisted(() => ({
  renameDeck: vi.fn(),
  deleteDeck: vi.fn(),
  leaveDeck: vi.fn(),
  saveCard: vi.fn(),
  deleteCard: vi.fn(),
  respondToAccessRequest: vi.fn(),
  removeEditor: vi.fn(),
}))
vi.mock('@/lib/actions/decks', () => actions)

const deck = { id: 'deck1', name: 'Date nights', shareId: 'share123' }
const shareUrl = 'https://example.com/d/share123'
const cards: DateCard[] = [
  { id: 'picnic', title: 'Picnic', description: '', tags: ['outside'] },
  { id: 'museum', title: 'Museum', description: 'See [the gallery](https://example.com)', tags: ['culture'] },
]
const access: DeckPerson[] = [
  { userId: 'u1', name: 'Alex', email: 'alex@example.com', status: 'pending' },
  { userId: 'u2', name: 'Sam', email: 'sam@example.com', status: 'accepted' },
]

function renderEditor({
  role = 'owner' as DeckRole,
  plans = [] as { id: string; createdAt: Date; cards: number }[],
} = {}) {
  return render(<DeckEditor deck={deck} role={role} access={access} shareUrl={shareUrl} cards={cards} plans={plans} />)
}

beforeEach(() => {
  for (const action of Object.values(actions)) {
    action.mockReset()
    action.mockResolvedValue({ ok: true, data: undefined })
  }
})

afterEach(() => vi.restoreAllMocks())

describe('DeckEditor', () => {
  /** @see docs/deck-sharing.md § "Who can do what" */
  describe('who sees what', () => {
    it('lets the owner rename and delete the deck, and manage who edits it', () => {
      renderEditor()
      expect(screen.getByRole('button', { name: 'Rename' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Delete deck' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Leave deck' })).not.toBeInTheDocument()
      expect(screen.getByRole('region', { name: 'Edit requests' })).toBeInTheDocument()
      expect(screen.getByRole('region', { name: 'Editors' })).toBeInTheDocument()
    })

    /** @see docs/deck-sharing.md § "Removing and leaving" - an editor sees Leave deck in place of Rename and Delete */
    it('gives an editor Leave deck instead, and no say over who edits', () => {
      renderEditor({ role: 'editor' })
      expect(screen.getByRole('button', { name: 'Leave deck' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Rename' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Delete deck' })).not.toBeInTheDocument()
      expect(screen.queryByRole('region', { name: 'Edit requests' })).not.toBeInTheDocument()
      expect(screen.queryByRole('region', { name: 'Editors' })).not.toBeInTheDocument()
    })
  })

  describe('renaming', () => {
    it('saves the new name and closes the form', async () => {
      const user = userEvent.setup()
      renderEditor()

      await user.click(screen.getByRole('button', { name: 'Rename' }))
      const name = screen.getByRole('textbox', { name: 'Deck name' })
      expect(name).toHaveValue('Date nights')
      await user.clear(name)
      await user.type(name, 'Weekend plans')
      await user.click(screen.getByRole('button', { name: 'Save' }))

      expect(actions.renameDeck).toHaveBeenCalledWith('deck1', 'Weekend plans')
      await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Deck name' })).not.toBeInTheDocument())
    })

    it('shows why the deck could not be renamed', async () => {
      actions.renameDeck.mockResolvedValue({ ok: false, error: 'Name is too long' })
      const user = userEvent.setup()
      renderEditor()

      await user.click(screen.getByRole('button', { name: 'Rename' }))
      await user.click(screen.getByRole('button', { name: 'Save' }))
      expect(await screen.findByRole('alert')).toHaveTextContent('Name is too long')
    })

    it('puts the name back on Cancel', async () => {
      const user = userEvent.setup()
      renderEditor()

      await user.click(screen.getByRole('button', { name: 'Rename' }))
      await user.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(screen.queryByRole('textbox', { name: 'Deck name' })).not.toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Date nights' })).toBeInTheDocument()
      expect(actions.renameDeck).not.toHaveBeenCalled()
    })
  })

  describe('deleting the deck', () => {
    it('asks first, and keeps the deck if the answer is no', async () => {
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
      const user = userEvent.setup()
      renderEditor()

      await user.click(screen.getByRole('button', { name: 'Delete deck' }))
      expect(confirm).toHaveBeenCalled()
      expect(actions.deleteDeck).not.toHaveBeenCalled()
    })

    it('deletes the deck once confirmed', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      const user = userEvent.setup()
      renderEditor()

      await user.click(screen.getByRole('button', { name: 'Delete deck' }))
      expect(actions.deleteDeck).toHaveBeenCalledWith('deck1')
    })

    it('shows why the deck could not be deleted', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      actions.deleteDeck.mockResolvedValue({ ok: false, error: 'Deck not found' })
      const user = userEvent.setup()
      renderEditor()

      await user.click(screen.getByRole('button', { name: 'Delete deck' }))
      expect(await screen.findByRole('alert')).toHaveTextContent('Deck not found')
    })
  })

  /** @see docs/deck-sharing.md § "Removing and leaving" - an editor sees Leave deck */
  describe('leaving the deck', () => {
    it('asks first, and stays if the answer is no', async () => {
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
      const user = userEvent.setup()
      renderEditor({ role: 'editor' })

      await user.click(screen.getByRole('button', { name: 'Leave deck' }))
      expect(confirm).toHaveBeenCalled()
      expect(actions.leaveDeck).not.toHaveBeenCalled()
    })

    it('leaves once confirmed', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      const user = userEvent.setup()
      renderEditor({ role: 'editor' })

      await user.click(screen.getByRole('button', { name: 'Leave deck' }))
      await waitFor(() => expect(actions.leaveDeck).toHaveBeenCalled())
      expect(actions.leaveDeck.mock.calls[0][0]).toBe('deck1')
    })
  })

  it('copies the share link', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('button', { name: 'Copy' }))
    expect(await navigator.clipboard.readText()).toBe(shareUrl)
    expect(screen.getByRole('button', { name: 'Copied!' })).toBeInTheDocument()
  })

  describe('opening a card from the keyboard', () => {
    it.each(['{Enter}', ' '])('opens a card in the editor with %j', async (key) => {
      const user = userEvent.setup()
      renderEditor()

      screen.getByRole('button', { name: 'Edit Picnic' }).focus()
      await user.keyboard(key)
      expect(await screen.findByRole('dialog', { name: 'Edit idea' })).toBeInTheDocument()
      expect(screen.getByRole('textbox', { name: /^Title/ })).toHaveValue('Picnic')
    })

    it("leaves Enter on a link in a card's description to the link", async () => {
      const user = userEvent.setup()
      renderEditor()

      screen.getByRole('link', { name: 'the gallery' }).focus()
      await user.keyboard('{Enter}')
      expect(screen.queryByRole('dialog', { name: 'Edit idea' })).not.toBeInTheDocument()
    })
  })

  describe('plans', () => {
    it('lists each plan with how many ideas it has', () => {
      renderEditor({
        plans: [
          { id: 'plan1', createdAt: new Date('2026-09-01T10:00:00Z'), cards: 1 },
          { id: 'plan2', createdAt: new Date('2026-09-02T10:00:00Z'), cards: 2 },
        ],
      })
      const [first, second] = screen.getAllByRole('listitem').filter((item) => item.querySelector('a[href^="/p/"]'))
      expect(first).toHaveTextContent('1 idea')
      expect(first.querySelector('a')).toHaveAttribute('href', '/p/plan1')
      expect(second).toHaveTextContent('2 ideas')
      expect(second.querySelector('a')).toHaveAttribute('href', '/p/plan2')
    })

    it('says where plans will come from when there are none', () => {
      renderEditor()
      expect(
        screen.getByText('When someone builds a plan from your link and presses Done, it shows up here.'),
      ).toBeInTheDocument()
    })
  })
})
