// Picks in progress, kept in this browser (docs/plans.md § "Picks are kept in
// the browser"). A new plan's picks are kept per deck in local storage, so
// they're there next time. Changes to a saved plan are kept per plan in
// session storage: they survive a reload, but not the tab closing, and the
// plan page forgets them (forgetPlanEdits).
//
// Storage can be missing or refuse (a private window, blocked site data), in
// which case the picks just aren't kept.

import { keepCards, parsePicks } from '@/lib/plan-picks'
import type { PlanPicks } from '@/types'

export type PicksPlace = { shareId: string; planId?: string }

function storageFor({ planId }: PicksPlace) {
  return planId ? window.sessionStorage : window.localStorage
}

function keyFor({ shareId, planId }: PicksPlace) {
  return planId ? `build-a-date:picks:plan:${planId}` : `build-a-date:picks:deck:${shareId}`
}

// Only cards still in the deck, each once, in their rows and groups. Picks
// kept before groups were a plain list of ids, which become the first row.
export function readPicks(place: PicksPlace, inDeck: { has: (id: string) => boolean }): PlanPicks | null {
  try {
    const stored = parsePicks(JSON.parse(storageFor(place).getItem(keyFor(place)) ?? 'null'))
    return stored && keepCards(stored, (id) => inDeck.has(id))
  } catch {
    return null
  }
}

// null forgets them.
export function writePicks(place: PicksPlace, picks: PlanPicks | null) {
  try {
    if (picks) storageFor(place).setItem(keyFor(place), JSON.stringify(picks))
    else storageFor(place).removeItem(keyFor(place))
  } catch {}
}

export function forgetPlanEdits(planId: string) {
  writePicks({ shareId: '', planId }, null)
}
