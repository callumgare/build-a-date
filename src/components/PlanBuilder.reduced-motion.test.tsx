/** @vitest-environment jsdom */
import { fireEvent, screen } from '@testing-library/react'
import { mediaMatching } from '@/test/media'
import { keepPicks, renderBuilder, resetPlanBuilder } from '@/test/plan-builder'

vi.mock('@/lib/actions/plans', () => import('@/test/plan-builder-mocks'))
vi.mock('@/lib/actions/decks', () => import('@/test/plan-builder-mocks'))
vi.mock('@/lib/actions/preferences', () => import('@/test/plan-builder-mocks'))
vi.mock('@/lib/og/client', () => import('@/test/plan-builder-mocks'))
vi.mock('next/navigation', () => import('@/test/plan-builder-mocks'))
vi.mock('next/link', () => import('@/test/plan-builder-mocks'))

// Motion reads prefers-reduced-motion the first time it's asked, once per
// file, so it's set for every test here, before anything renders. The same
// flights with motion allowed are in PlanBuilder.layout.test.tsx.
beforeEach(() => {
  resetPlanBuilder()
  vi.spyOn(window, 'matchMedia').mockImplementation(mediaMatching('(prefers-reduced-motion)'))
  // jsdom lays nothing out, so a flight would have nowhere to land.
  vi.spyOn(HTMLElement.prototype, 'offsetParent', 'get').mockImplementation(function (this: HTMLElement) {
    return this.parentElement
  })
})
afterEach(() => vi.restoreAllMocks())

// The stand-ins flying between the deck and the plan, drawn over the page.
function flyingCards() {
  return document.body.querySelectorAll(':scope > [aria-hidden="true"]')
}

describe('PlanBuilder with reduced motion', () => {
  /**
   * @see docs/card-layout.md § "Flying cards" - with reduced motion there's no flight
   * @see docs/card-layout.md § "The plan column" - with reduced motion the slot goes straight away
   */
  it('puts a picked card straight into the plan, and the slot goes straight away', () => {
    const { container } = renderBuilder()

    fireEvent.click(screen.getByRole('button', { name: 'Add to plan: Museum' }))
    expect(flyingCards()).toHaveLength(0)
    expect(container.querySelector('[data-plan-row] [data-empty-slot]')).not.toBeInTheDocument()
    expect(container.querySelector('[data-card-id="museum"]')).toBeInTheDocument()
  })

  /** @see docs/card-layout.md § "Flying cards" - with reduced motion there's no flight */
  it('puts a discarded card straight back in the deck', () => {
    keepPicks(['museum', 'hike'])
    const { container } = renderBuilder()

    fireEvent.click(screen.getByRole('button', { name: 'Discard: Museum' }))
    expect(flyingCards()).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Clear plan' }))
    expect(flyingCards()).toHaveLength(0)
    expect(container.querySelector('[data-deck-card-id="hike"]')).toBeInTheDocument()
  })
})
