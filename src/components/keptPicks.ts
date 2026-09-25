// Picks in progress, kept in this browser (docs/plans.md § "Picks are kept in
// the browser"). A new plan's picks are kept per deck in local storage, so
// they're there next time. Changes to a saved plan are kept per plan in
// session storage: they survive a reload, but not the tab closing, and the
// plan page forgets them (forgetPlanEdits).
//
// Storage can be missing or refuse (a private window, blocked site data), in
// which case the picks just aren't kept.

export type PicksPlace = { shareId: string; planId?: string }

function storageFor({ planId }: PicksPlace) {
  return planId ? window.sessionStorage : window.localStorage
}

function keyFor({ shareId, planId }: PicksPlace) {
  return planId ? `build-a-date:picks:plan:${planId}` : `build-a-date:picks:deck:${shareId}`
}

// Only ids of cards still in the deck, each once.
export function readPicks(place: PicksPlace, inDeck: { has: (id: string) => boolean }): string[] | null {
  try {
    const stored: unknown = JSON.parse(storageFor(place).getItem(keyFor(place)) ?? 'null')
    if (!Array.isArray(stored)) return null
    const seen = new Set<string>()
    return stored.filter(
      (id): id is string => typeof id === 'string' && inDeck.has(id) && !seen.has(id) && Boolean(seen.add(id)),
    )
  } catch {
    return null
  }
}

// null forgets them.
export function writePicks(place: PicksPlace, ids: string[] | null) {
  try {
    if (ids) storageFor(place).setItem(keyFor(place), JSON.stringify(ids))
    else storageFor(place).removeItem(keyFor(place))
  } catch {}
}

export function forgetPlanEdits(planId: string) {
  writePicks({ shareId: '', planId }, null)
}
