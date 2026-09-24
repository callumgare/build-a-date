import { z } from 'zod'

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

export const planInput = z.object({
  shareId: id,
  cardIds: z.array(id).min(1).max(50),
})

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
