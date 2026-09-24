/** @vitest-environment jsdom */
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DateCard } from '@/types'
import DeckBuilder from './DeckBuilder'

const savePlan = vi.hoisted(() => vi.fn())
vi.mock('@/lib/actions/plans', () => ({ savePlan }))
vi.mock('next/link', () => ({ default: (props: object) => <a {...props} /> }))

const cards: DateCard[] = [
  { id: 'picnic', title: 'Picnic', description: '', tags: ['outside'] },
  { id: 'museum', title: 'Museum', description: '', tags: ['culture'] },
  { id: 'hike', title: 'Hike', description: '', tags: ['outside', 'active'] },
]

function renderBuilder() {
  return render(<DeckBuilder deckName="Test deck" shareId="share123" cards={cards} seed={1} />)
}

beforeEach(() => {
  savePlan.mockReset()
  window.location.hash = ''
  Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
})

describe('DeckBuilder', () => {
  it('shows the deck name and every card', () => {
    renderBuilder()
    expect(screen.getByRole('heading', { name: 'Test deck' })).toBeInTheDocument()
    for (const card of cards)
      expect(screen.getByRole('button', { name: `Add ${card.title} to your plan` })).toBeInTheDocument()
  })

  it('moves a picked card into the plan and back out', async () => {
    const user = userEvent.setup()
    renderBuilder()

    await user.click(screen.getByRole('button', { name: 'Add Picnic to your plan' }))
    expect(screen.getByRole('button', { name: 'Remove Picnic from your plan' })).toBeInTheDocument()
    expect(window.location.hash).toBe('#picnic')

    await user.click(screen.getByRole('button', { name: 'Remove Picnic from your plan' }))
    expect(await screen.findByRole('button', { name: 'Add Picnic to your plan' })).toBeInTheDocument()
  })

  it('restores picks from the URL hash', async () => {
    window.location.hash = '#museum,not-a-card'
    renderBuilder()
    expect(await screen.findByRole('button', { name: 'Remove Museum from your plan' })).toBeInTheDocument()
  })

  it('filters the deck by tag', async () => {
    const user = userEvent.setup()
    renderBuilder()
    const filters = screen.getByRole('group', { name: 'Filter ideas by tag' })

    await user.click(within(filters).getByRole('button', { name: 'culture' }))
    expect(await screen.findByRole('button', { name: 'Add Museum to your plan' })).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Add Picnic to your plan' })).not.toBeInTheDocument(),
    )
  })

  it('saves the plan when Done is pressed and offers its link', async () => {
    savePlan.mockResolvedValue({ ok: true, data: { planId: 'plan42' } })
    const user = userEvent.setup()
    renderBuilder()

    await user.click(screen.getByRole('button', { name: 'Add Hike to your plan' }))
    await user.click(screen.getByRole('button', { name: 'Add Museum to your plan' }))
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

    await user.click(screen.getByRole('button', { name: 'Add Hike to your plan' }))
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Deck not found')
  })
})
