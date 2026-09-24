'use server'

import { getDb } from '@/db'
import * as decks from '../decks'
import { planInput } from '../validation'
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
