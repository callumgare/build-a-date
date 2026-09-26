import type { PlanGroup, PlanPicks } from '@/types'

// The cards picked for a plan, on its rows: the first row, then a row for
// each group (docs/plans.md § "Groups"). Used by the builder, what it keeps
// in the browser, and the server, so they all follow the same rules. Each
// function hands back the picks it was given when nothing changes.

// The first row's id. A group's id is never empty.
export const firstRow = ''

export const noPicks: PlanPicks = { cardIds: [], groups: [] }

export function rowsOf(picks: PlanPicks): { id: string; cardIds: string[] }[] {
  return [{ id: firstRow, cardIds: picks.cardIds }, ...picks.groups]
}

// Every picked card, row by row.
export function pickedIds(picks: PlanPicks): string[] {
  return rowsOf(picks).flatMap((row) => row.cardIds)
}

export function rowOf(picks: PlanPicks, id: string): string | null {
  return rowsOf(picks).find((row) => row.cardIds.includes(id))?.id ?? null
}

// Compares picks; two with the same key are the same plan.
export function picksKey(picks: PlanPicks): string {
  return JSON.stringify([
    picks.cardIds,
    picks.groups.map((group) => [group.id, group.title, group.notes, group.cardIds]),
  ])
}

function mapRows(picks: PlanPicks, change: (cardIds: string[], rowId: string) => string[]): PlanPicks {
  const cardIds = change(picks.cardIds, firstRow)
  let changed = cardIds !== picks.cardIds
  const groups = picks.groups.map((group) => {
    const next = change(group.cardIds, group.id)
    if (next === group.cardIds) return group
    changed = true
    return { ...group, cardIds: next }
  })
  return changed ? { cardIds, groups } : picks
}

// Onto the end of the first row, unless it's already picked.
export function addCard(picks: PlanPicks, id: string): PlanPicks {
  if (rowOf(picks, id) !== null) return picks
  return { ...picks, cardIds: [...picks.cardIds, id] }
}

export function removeCard(picks: PlanPicks, id: string): PlanPicks {
  return mapRows(picks, (cardIds) => (cardIds.includes(id) ? cardIds.filter((cardId) => cardId !== id) : cardIds))
}

// Puts a picked card at a place in a row, among the other cards there.
export function placeCard(picks: PlanPicks, id: string, row: string, index: number): PlanPicks {
  const from = rowOf(picks, id)
  if (from === null || !rowsOf(picks).some((each) => each.id === row)) return picks
  const current = rowsOf(picks).find((each) => each.id === row)?.cardIds ?? []
  const others = current.filter((cardId) => cardId !== id)
  const at = Math.max(0, Math.min(index, others.length))
  if (from === row && current.indexOf(id) === at) return picks
  const placed = [...others.slice(0, at), id, ...others.slice(at)]
  return mapRows(removeCard(picks, id), (cardIds, rowId) => (rowId === row ? placed : cardIds))
}

// From the keyboard: one place along its row, or onto the row above or below
// at the same place, or the end of it if that's shorter (docs/card-layout.md
// § "Reordering the plan").
export function moveCardBy(picks: PlanPicks, id: string, move: { along?: -1 | 1; across?: -1 | 1 }): PlanPicks {
  const rows = rowsOf(picks)
  const rowIndex = rows.findIndex((row) => row.cardIds.includes(id))
  if (rowIndex === -1) return picks
  const index = rows[rowIndex].cardIds.indexOf(id)
  if (move.across) {
    const target = rows[rowIndex + move.across]
    return target ? placeCard(picks, id, target.id, index) : picks
  }
  const to = index + (move.along ?? 0)
  if (to < 0 || to >= rows[rowIndex].cardIds.length) return picks
  return placeCard(picks, id, rows[rowIndex].id, to)
}

// Only cards that pass, each once, in the first place it's found.
export function keepCards(picks: PlanPicks, keep: (id: string) => boolean): PlanPicks {
  const seen = new Set<string>()
  return mapRows(picks, (cardIds) => {
    const kept = cardIds.filter((id) => keep(id) && !seen.has(id) && Boolean(seen.add(id)))
    return kept.length === cardIds.length ? cardIds : kept
  })
}

export function addGroup(picks: PlanPicks, id: string): PlanPicks {
  return { ...picks, groups: [...picks.groups, { id, title: '', notes: '', cardIds: [] }] }
}

// Its cards go back onto the end of the first row, rather than out of the plan.
export function removeGroup(picks: PlanPicks, id: string): PlanPicks {
  const group = picks.groups.find((each) => each.id === id)
  if (!group) return picks
  return {
    cardIds: [...picks.cardIds, ...group.cardIds],
    groups: picks.groups.filter((each) => each !== group),
  }
}

export function changeGroup(picks: PlanPicks, id: string, change: Partial<Pick<PlanGroup, 'title' | 'notes'>>) {
  return { ...picks, groups: picks.groups.map((group) => (group.id === id ? { ...group, ...change } : group)) }
}

// A group with no title, notes or cards says nothing, so it isn't saved.
export function isBlankGroup(group: PlanGroup) {
  return !group.title.trim() && !group.notes.trim() && group.cardIds.length === 0
}

// Picks read back from storage, which may be from an older version (a plain
// list of card ids) or not picks at all.
export function parsePicks(stored: unknown): PlanPicks | null {
  if (Array.isArray(stored)) return { cardIds: stored.filter(isString), groups: [] }
  if (!stored || typeof stored !== 'object') return null
  const { cardIds, groups } = stored as Record<string, unknown>
  if (!Array.isArray(cardIds) || !Array.isArray(groups)) return null
  const seenGroups = new Set<string>()
  return {
    cardIds: cardIds.filter(isString),
    groups: groups.flatMap((group): PlanGroup[] => {
      if (!group || typeof group !== 'object') return []
      const { id, title, notes, cardIds: groupCards } = group as Record<string, unknown>
      if (!isString(id) || !id || seenGroups.has(id) || !Array.isArray(groupCards)) return []
      seenGroups.add(id)
      return [
        {
          id,
          title: isString(title) ? title : '',
          notes: isString(notes) ? notes : '',
          cardIds: groupCards.filter(isString),
        },
      ]
    }),
  }
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}
