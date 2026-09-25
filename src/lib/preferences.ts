import { eq } from 'drizzle-orm'
import type { Database } from '@/db'
import { userPreference } from '@/db/schema'
import type { DeckSort } from './deck-order'

// The Sort by option someone last picked, or Random if they never have
// (docs/deck-sorting.md § "Remembering the choice").
export async function getDeckSort(db: Database, userId: string): Promise<DeckSort> {
  const row = await db.query.userPreference.findFirst({
    columns: { deckSort: true },
    where: eq(userPreference.userId, userId),
  })
  return row?.deckSort ?? 'random'
}

export async function saveDeckSort(db: Database, userId: string, deckSort: DeckSort) {
  await db
    .insert(userPreference)
    .values({ userId, deckSort })
    .onConflictDoUpdate({ target: userPreference.userId, set: { deckSort } })
}
