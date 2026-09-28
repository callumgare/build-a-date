// What the PlanBuilder tests share: a small deck, the builder rendered from
// it, and ways to read and set the picks this browser keeps. The stand-ins it
// talks to are in '@/test/plan-builder-mocks', re-exported here; each test
// file still mocks the modules itself, and calls resetPlanBuilder() before
// each test.
import { render } from '@testing-library/react'
import PlanBuilder from '@/components/PlanBuilder'
import type { DateCard, PlanGroup, PlanPicks } from '@/types'
import * as mocks from './plan-builder-mocks'

export {
  deleteCard,
  deletePlan,
  drawPreview,
  preloadPreview,
  quickAddCard,
  router,
  saveCard,
  saveCardNotes,
  saveDeckSort,
  savePlan,
  updatePlan,
} from './plan-builder-mocks'

// The link preview the stand-in draws.
export const drawn = { key: 'drawn-key', image: new Blob(['jpeg']) }

export const cards: DateCard[] = [
  { id: 'picnic', title: 'Picnic', description: '', tags: ['outside'], interest: 2, notes: 'Bring a rug' },
  { id: 'museum', title: 'Museum', description: 'See [the gallery](https://example.com)', tags: ['culture'] },
  { id: 'hike', title: 'Hike', description: '', tags: ['outside', 'active'] },
]

export function renderBuilder() {
  return render(<PlanBuilder deckName="Test deck" shareId="share123" cards={cards} seed={1} />)
}

export const deckPicks = 'build-a-date:picks:deck:share123'

// The picks this browser has kept for the deck, or null for none. Changes to
// a saved plan are kept in session storage instead.
export function storageFor(key: string) {
  return key.includes(':plan:') ? sessionStorage : localStorage
}

export function keptPicks(key = deckPicks) {
  return JSON.parse(storageFor(key).getItem(key) ?? 'null')
}

// Picks as they're kept: the plan's first row, and its groups.
export function picks(cardIds: string[], groups: PlanGroup[] = []): PlanPicks {
  return { cardIds, groups }
}

export function keepPicks(ids: string[] | PlanPicks, key = deckPicks) {
  storageFor(key).setItem(key, JSON.stringify(Array.isArray(ids) ? picks(ids) : ids))
}

// The ids of the cards in the deck, and in the plan, in the order they're in.
export function deckOrder(container: HTMLElement) {
  return [...container.querySelectorAll('[data-deck-card-id]')].map((card) => card.getAttribute('data-deck-card-id'))
}

export function planOrder(container: HTMLElement) {
  return [...container.querySelectorAll('[data-card-id]')].map((card) => card.getAttribute('data-card-id'))
}

// A card in the deck, or in the plan, 200px wide, so x < 100 is its left
// half.
export function deckCard(container: HTMLElement, id: string) {
  const element = container.querySelector(`[data-deck-card-id="${id}"]`) as HTMLElement
  element.getBoundingClientRect = () => new DOMRect(0, 0, 200, 266)
  return element
}

export function planCard(container: HTMLElement, id: string) {
  const element = container.querySelector(`[data-card-id="${id}"]`) as HTMLElement
  element.getBoundingClientRect = () => new DOMRect(0, 0, 200, 266)
  return element
}

export function resetPlanBuilder() {
  for (const action of [mocks.savePlan, mocks.updatePlan, mocks.deletePlan, mocks.router.push]) action.mockReset()
  mocks.drawPreview.mockReset()
  mocks.drawPreview.mockResolvedValue(drawn)
  mocks.preloadPreview.mockReset()
  for (const action of [
    mocks.saveCardNotes,
    mocks.saveDeckSort,
    mocks.saveCard,
    mocks.deleteCard,
    mocks.quickAddCard,
  ]) {
    action.mockReset()
    action.mockResolvedValue({ ok: true, data: undefined })
  }
  localStorage.clear()
  sessionStorage.clear()
  Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
}
