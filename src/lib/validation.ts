import { z } from 'zod'
import type { DeckSort } from './deck-order'

const id = z.string().min(1).max(64)

export const deckInput = z.object({
  name: z.string().trim().min(1, 'Give your deck a name').max(80),
})

export const newDeckInput = deckInput.extend({
  template: z.enum(['empty', 'suggestions']),
})

export const cardInput = z.object({
  title: z.string().trim().min(1, 'Give the idea a title').max(80),
  description: z.string().trim().max(1000).default(''),
  tags: z
    .array(z.string().trim().toLowerCase().min(1).max(24))
    .max(8)
    .default([])
    .transform((tags) => [...new Set(tags)]),
  date: z
    .string()
    .trim()
    .max(80)
    .nullish()
    .transform((date) => date || null),
})

export const quickAddInput = z
  .string()
  .trim()
  .min(1, 'Type a little about the idea, or paste a link')
  .max(2000, 'Keep it under 2000 characters')

// A plan's first row may be empty when its cards are all in groups, but the
// plan as a whole needs a card (checked with the deck's cards, in
// keepDeckCards).
const planCards = z.array(id).max(50)

export const planGroupInput = z.object({
  id,
  title: z.string().trim().max(80, 'Group titles can be up to 80 characters'),
  notes: z.string().trim().max(2000, 'Group notes can be up to 2000 characters'),
  cardIds: planCards,
})

const planPicks = {
  cardIds: planCards,
  groups: z.array(planGroupInput).max(20, 'A plan can have up to 20 groups').default([]),
}

const hasACard = [
  (plan: { cardIds: string[]; groups: { cardIds: string[] }[] }) =>
    plan.cardIds.length + plan.groups.reduce((total, group) => total + group.cardIds.length, 0) > 0,
  { message: 'Pick at least one idea for the plan' },
] as const

export const planInput = z.object({ shareId: id, ...planPicks }).refine(...hasACard)

export const planIdInput = id

export const planUpdateInput = z.object({ planId: id, ...planPicks }).refine(...hasACard)

export const cardNotesInput = z.object({
  shareId: id,
  cardId: id,
  interest: z.number().int().min(1).max(5).nullable(),
  notes: z.string().trim().max(2000, 'Notes can be up to 2000 characters'),
})

export const deckSortInput = z.enum(['random', 'added', 'interest'] satisfies DeckSort[])

export type CardInput = z.input<typeof cardInput>

// Where to send someone after they sign in. Only paths on this site, so a
// crafted sign-in link can't bounce people somewhere else. Browsers drop tabs
// and newlines from URLs and read backslashes as slashes, so "/\t/evil.com"
// would otherwise become "//evil.com".
export function safeNextPath(next: unknown): string | undefined {
  if (typeof next !== 'string' || !next.startsWith('/')) return undefined
  // biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are what it looks for
  if (/[\x00-\x1f\\]/.test(next) || next.startsWith('//')) return undefined
  return next
}
