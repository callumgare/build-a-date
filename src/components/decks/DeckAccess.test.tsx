/** @vitest-environment jsdom */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AccessRequests, type DeckPerson, Editors } from './DeckAccess'

const { respondToAccessRequest, removeEditor } = vi.hoisted(() => ({
  respondToAccessRequest: vi.fn(),
  removeEditor: vi.fn(),
}))
vi.mock('@/lib/actions/decks', () => ({ respondToAccessRequest, removeEditor }))

const people: DeckPerson[] = [
  { userId: 'u1', name: 'Alex', email: 'alex@example.com', status: 'pending' },
  { userId: 'u2', name: '', email: 'jo@example.com', status: 'pending' },
  { userId: 'u3', name: 'Sam', email: 'sam@example.com', status: 'accepted' },
  { userId: 'u4', name: '', email: 'kim@example.com', status: 'accepted' },
]

beforeEach(() => {
  respondToAccessRequest.mockReset()
  removeEditor.mockReset()
  respondToAccessRequest.mockResolvedValue({ ok: true, data: undefined })
  removeEditor.mockResolvedValue({ ok: true, data: undefined })
})

afterEach(() => vi.restoreAllMocks())

describe('AccessRequests', () => {
  it('shows nothing when nobody is asking', () => {
    const { container } = render(
      <AccessRequests deckId="deck1" people={people.filter((p) => p.status !== 'pending')} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('lists only the people asking to edit', () => {
    render(<AccessRequests deckId="deck1" people={people} />)
    const requests = screen.getByRole('region', { name: 'Edit requests' })
    expect(within(requests).getAllByRole('listitem')).toHaveLength(2)
    expect(within(requests).getByText('Alex')).toBeInTheDocument()
    expect(within(requests).queryByText('Sam')).not.toBeInTheDocument()
  })

  it('labels someone without a name by their email', () => {
    render(<AccessRequests deckId="deck1" people={people} />)
    expect(screen.getByRole('button', { name: 'Accept jo@example.com' })).toBeInTheDocument()
    expect(screen.getByText('jo@example.com')).toBeInTheDocument()
  })

  /** @see docs/deck-sharing.md § "Answering requests" - the owner sees Accept and Decline */
  it('accepts a request', async () => {
    const user = userEvent.setup()
    render(<AccessRequests deckId="deck1" people={people} />)

    await user.click(screen.getByRole('button', { name: 'Accept Alex' }))
    expect(respondToAccessRequest).toHaveBeenCalledWith('deck1', 'u1', true)
  })

  /** @see docs/deck-sharing.md § "Answering requests" - the owner sees Accept and Decline */
  it('declines a request', async () => {
    const user = userEvent.setup()
    render(<AccessRequests deckId="deck1" people={people} />)

    await user.click(screen.getByRole('button', { name: 'Decline jo@example.com' }))
    expect(respondToAccessRequest).toHaveBeenCalledWith('deck1', 'u2', false)
  })

  it('shows why a request could not be answered', async () => {
    respondToAccessRequest.mockResolvedValue({ ok: false, error: 'That request has already been answered' })
    const user = userEvent.setup()
    render(<AccessRequests deckId="deck1" people={people} />)

    await user.click(screen.getByRole('button', { name: 'Accept Alex' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('That request has already been answered')
  })
})

describe('Editors', () => {
  /** @see docs/deck-sharing.md § "Removing and leaving" - the owner's deck page lists editors, each with Remove */
  it('lists only the accepted editors', () => {
    render(<Editors deckId="deck1" people={people} />)
    const editors = screen.getByRole('region', { name: 'Editors' })
    expect(within(editors).getAllByRole('listitem')).toHaveLength(2)
    expect(within(editors).getByText('Sam')).toBeInTheDocument()
    expect(within(editors).getByText('kim@example.com')).toBeInTheDocument()
    expect(within(editors).queryByText('Alex')).not.toBeInTheDocument()
  })

  it('says how people become editors when there are none', () => {
    render(<Editors deckId="deck1" people={people.filter((p) => p.status === 'pending')} />)
    expect(screen.getByText(/Anyone with the share link can ask to help edit this deck/)).toBeInTheDocument()
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  })

  it('asks before removing an editor, and keeps them if the answer is no', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    render(<Editors deckId="deck1" people={people} />)

    await user.click(screen.getByRole('button', { name: 'Remove kim@example.com' }))
    expect(confirm).toHaveBeenCalledWith('Stop kim@example.com editing this deck?')
    expect(removeEditor).not.toHaveBeenCalled()
  })

  /** @see docs/deck-sharing.md § "Removing and leaving" - the owner's deck page lists editors, each with Remove */
  it('removes an editor once confirmed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(<Editors deckId="deck1" people={people} />)

    await user.click(screen.getByRole('button', { name: 'Remove Sam' }))
    expect(removeEditor).toHaveBeenCalledWith('deck1', 'u3')
  })

  it('shows why an editor could not be removed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    removeEditor.mockResolvedValue({ ok: false, error: 'Deck not found' })
    const user = userEvent.setup()
    render(<Editors deckId="deck1" people={people} />)

    await user.click(screen.getByRole('button', { name: 'Remove Sam' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Deck not found')
  })
})
