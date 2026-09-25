'use server'

import { revalidatePath } from 'next/cache'
import { getDb } from '@/db'
import * as decks from '../decks'
import { cardNotesInput, planIdInput, planInput, planUpdateInput } from '../validation'
import { type ActionResult, fail, ok } from './result'

// Public: anyone with a deck's share link can save a plan from it.
export async function savePlan(shareId: string, cardIds: string[]): Promise<ActionResult<{ planId: string }>> {
  try {
    const input = planInput.parse({ shareId, cardIds })
    const saved = await decks.savePlan(getDb(), input.shareId, input.cardIds)
    revalidatePlanLists()
    return ok({ planId: saved.id })
  } catch (error) {
    return fail(error)
  }
}

// Owners and editors see the deck's plans listed on its page and on the shared
// deck, including the one they just saved.
function revalidatePlanLists() {
  revalidatePath('/decks/[deckId]', 'page')
  revalidatePath('/d/[shareId]', 'page')
  revalidatePath('/p/[planId]/edit', 'page')
}

// Public too: anyone with a plan's link can change it (docs/plans.md § "Who can
// edit a plan").
export async function updatePlan(planId: string, cardIds: string[]): Promise<ActionResult<{ planId: string }>> {
  try {
    const input = planUpdateInput.parse({ planId, cardIds })
    const saved = await decks.updatePlan(getDb(), input.planId, input.cardIds)
    revalidatePlanLists()
    return ok({ planId: saved.id })
  } catch (error) {
    return fail(error)
  }
}

// Public too, like editing it (docs/plans.md § "Deleting a plan").
export async function deletePlan(planId: string): Promise<ActionResult> {
  try {
    await decks.deletePlan(getDb(), planIdInput.parse(planId))
    revalidatePlanLists()
    return ok(undefined)
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
