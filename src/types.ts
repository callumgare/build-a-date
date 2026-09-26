export type DateCard = {
  id: string
  title: string
  description: string
  tags: string[]
  date?: string
  // 1–5 stars, left out until someone rates it.
  interest?: number
  notes?: string
  // When the card was made, as an ISO timestamp. Left out of the starter cards,
  // which aren't in a deck yet.
  addedAt?: string
}

// A group of cards in a plan, on a row of its own under the plan's other
// cards, with a title and notes (docs/plans.md § "Groups").
export type PlanGroup = {
  id: string
  title: string
  notes: string
  cardIds: string[]
}

// What's picked for a plan: the cards on its first row, then its groups.
export type PlanPicks = {
  cardIds: string[]
  groups: PlanGroup[]
}
