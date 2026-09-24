export type DateCard = {
  id: string
  title: string
  description: string
  tags: string[]
  date?: string
  // 1–5 stars, left out until someone rates it.
  interest?: number
  notes?: string
}
