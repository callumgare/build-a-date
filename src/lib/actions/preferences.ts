'use server'

import { getDb } from '@/db'
import { getSession } from '../auth'
import type { DeckSort } from '../deck-order'
import * as preferences from '../preferences'
import { deckSortInput } from '../validation'
import { type ActionResult, fail, ok } from './result'

// Remembers the Sort by option for the signed-in account (docs/deck-sorting.md
// § "Remembering the choice"). The page calls it in the background, so a
// visitor whose session has run out isn't sent off to sign in: the sort still
// applies, it just isn't saved.
export async function saveDeckSort(sort: DeckSort): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return { ok: false, error: 'Sign in to remember how you sort decks' }
  try {
    await preferences.saveDeckSort(getDb(), session.user.id, deckSortInput.parse(sort))
    return ok(undefined)
  } catch (error) {
    return fail(error)
  }
}
