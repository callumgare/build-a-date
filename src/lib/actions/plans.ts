'use server'

import { revalidatePath } from 'next/cache'
import { getDb } from '@/db'
import type { PlanGroup } from '@/types'
import * as decks from '../decks'
import { keepPreview, PreviewRejected, planPreviewInput, type SentPreview } from '../previews'
import { cardNotesInput, planIdInput, planInput, planUpdateInput } from '../validation'
import { type ActionResult, fail, ok } from './result'

// Public: anyone with a deck's share link can save a plan from it. The
// browser sends the plan's link preview with it, if it could draw one, so the
// picture is there when the plan's link is shared (docs/share-previews.md
// § "When it's drawn").
export async function savePlan(
  shareId: string,
  cardIds: string[],
  groups: PlanGroup[] = [],
  preview?: SentPreview,
): Promise<ActionResult<{ planId: string }>> {
  try {
    const input = planInput.parse({ shareId, cardIds, groups })
    const saved = await decks.savePlan(getDb(), input.shareId, input.cardIds, input.groups)
    if (preview) await keepPlanPreview(saved.id, preview)
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
export async function updatePlan(
  planId: string,
  cardIds: string[],
  groups: PlanGroup[] = [],
  preview?: SentPreview,
): Promise<ActionResult<{ planId: string }>> {
  try {
    const input = planUpdateInput.parse({ planId, cardIds, groups })
    const saved = await decks.updatePlan(getDb(), input.planId, input.cardIds, input.groups)
    if (preview) await keepPlanPreview(saved.id, preview)
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

// Public too, like editing the plan: anyone with its link can draw its
// picture (docs/share-previews.md § "Who can upload a picture").
export async function savePlanPreview(planId: string, preview: SentPreview): Promise<ActionResult> {
  try {
    const db = getDb()
    const id = planIdInput.parse(planId)
    await keepPreview(db, 'plan', id, planPreviewInput(await decks.getPlan(db, id)), preview)
    return ok(undefined)
  } catch (error) {
    return fail(error)
  }
}

// A picture sent with a save that can't be kept (drawn from picks that were
// then trimmed, say) doesn't stop the plan saving: the plan's page draws
// another.
async function keepPlanPreview(planId: string, preview: SentPreview) {
  const db = getDb()
  try {
    await keepPreview(db, 'plan', planId, planPreviewInput(await decks.getPlan(db, planId)), preview)
  } catch (error) {
    if (!(error instanceof PreviewRejected)) throw error
  }
}
