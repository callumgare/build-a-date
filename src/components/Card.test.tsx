/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react'
import type { DateCard } from '@/types'
import Card from './Card'
import { frameFor } from './frames'

const card: DateCard = { id: 'picnic', title: 'Picnic', description: 'By the river', tags: [] }

function renderCard(scrawl?: { interest: number | null; notes: string }) {
  return render(<Card card={card} frame={frameFor(card.id)} scrawl={scrawl} />).container
}

function marks(container: HTMLElement) {
  return [...container.querySelectorAll('svg[data-mark]')].map((mark) => mark.getAttribute('data-mark'))
}

/** @see docs/card-notes.md § "Rating and notes on the card" */
describe('Card scrawl', () => {
  it('draws a star and the rating for a rated card', () => {
    const container = renderCard({ interest: 3, notes: '' })
    expect(marks(container)).toEqual(['star', 'rating'])
    expect(screen.getByText('Rated 3 out of 5.')).toBeInTheDocument()
  })

  it('writes a different number for each rating', () => {
    const drawn = [1, 2, 3, 4, 5].map((interest) => {
      const container = renderCard({ interest, notes: '' })
      const rating = container.querySelector('svg[data-mark="rating"]')?.innerHTML
      container.remove()
      return rating
    })
    expect(new Set(drawn).size).toBe(5)
  })

  it('scribbles for a card with notes', () => {
    const container = renderCard({ interest: null, notes: 'Bring a rug' })
    expect(marks(container)).toEqual(['notes'])
    expect(screen.getByText('Has notes.')).toBeInTheDocument()
  })

  it('puts the scribbles after the rating when there are both', () => {
    const container = renderCard({ interest: 5, notes: 'Bring a rug' })
    expect(marks(container)).toEqual(['star', 'rating', 'notes'])
    expect(screen.getByText('Rated 5 out of 5. Has notes.')).toBeInTheDocument()
  })

  it("doesn't count notes that are only spaces", () => {
    expect(marks(renderCard({ interest: null, notes: '  \n ' }))).toEqual([])
  })

  it('leaves the corner empty with no rating or notes', () => {
    expect(marks(renderCard({ interest: null, notes: '' }))).toEqual([])
    expect(screen.queryByText(/Rated|Has notes/)).not.toBeInTheDocument()
  })

  it('leaves the corner empty when not given a scrawl', () => {
    expect(marks(renderCard())).toEqual([])
  })
})
