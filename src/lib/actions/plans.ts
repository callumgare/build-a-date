'use server'

import { getDb } from '@/db'
import * as decks from '../decks'
import { cardNotesInput, planInput } from '../validation'
import { type ActionResult, fail, ok } from './result'

// Public: anyone with a deck's share link can save a plan from it.
export async function savePlan(shareId: string, cardIds: string[]): Promise<ActionResult<{ planId: string }>> {
  try {
    const input = planInput.parse({ shareId, cardIds })
    const saved = await decks.savePlan(getDb(), input.shareId, input.cardIds)
    return ok({ planId: saved.id })
  } catch (error) {
    return fail(error)
  }
}

// Public too: anyone with the share link can rate a card and write notes on it
// (docs/card-notes.md § "Who can change them").
export async function saveCardNotes(
  shareId: string,
  cardId: string,
  notes: { interest: number | null; notes: string },
): Promise<ActionResult> {
  try {
    const input = cardNotesInput.parse({ shareId, cardId, ...notes })
    await decks.saveCardNotes(getDb(), input.shareId, input.cardId, input)
    return ok(undefined)
  } catch (error) {
    return fail(error)
  }
}
