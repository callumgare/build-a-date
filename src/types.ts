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
