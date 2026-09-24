'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getDb } from '@/db'
import { requireUser } from '../auth'
import * as decks from '../decks'
import { type CardInput, cardInput, deckInput, newDeckInput } from '../validation'
import { type ActionResult, fail, ok } from './result'

export async function createDeck(input: { name: string; template: 'empty' | 'suggestions' }): Promise<ActionResult> {
  const user = await requireUser()
  let deckId: string
  try {
    deckId = (await decks.createDeck(getDb(), user.id, newDeckInput.parse(input))).id
  } catch (error) {
    return fail(error)
  }
  redirect(`/decks/${deckId}`)
}

export async function renameDeck(deckId: string, name: string): Promise<ActionResult> {
  const user = await requireUser()
  try {
    await decks.renameDeck(getDb(), user.id, deckId, deckInput.parse({ name }).name)
  } catch (error) {
    return fail(error)
  }
  revalidatePath(`/decks/${deckId}`)
  return ok(undefined)
}

export async function deleteDeck(deckId: string): Promise<ActionResult> {
  const user = await requireUser()
  try {
    await decks.deleteDeck(getDb(), user.id, deckId)
  } catch (error) {
    return fail(error)
  }
  redirect('/decks')
}

export async function saveCard(
  deckId: string,
  cardId: string | null,
  input: CardInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser()
  try {
    const saved = await decks.saveCard(getDb(), user.id, deckId, cardId, cardInput.parse(input))
    revalidatePath(`/decks/${deckId}`)
    return ok({ id: saved.id })
  } catch (error) {
    return fail(error)
  }
}

export async function deleteCard(deckId: string, cardId: string): Promise<ActionResult> {
  const user = await requireUser()
  try {
    await decks.deleteCard(getDb(), user.id, deckId, cardId)
  } catch (error) {
    return fail(error)
  }
  revalidatePath(`/decks/${deckId}`)
  return ok(undefined)
}
