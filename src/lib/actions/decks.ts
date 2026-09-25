'use server'

import { getCloudflareContext } from '@opennextjs/cloudflare'
import { revalidatePath } from 'next/cache'
import { notFound, redirect } from 'next/navigation'
import { z } from 'zod'
import { starterCards } from '@/data/starter-cards'
import { type Database, getDb } from '@/db'
import { requireUser } from '../auth'
import * as decks from '../decks'
import { editRequestEmail, sendEmail } from '../email'
import { type CardDraft, extractIdea, QuickAddError } from '../quick-add'
import { type CardInput, cardInput, deckInput, newDeckInput, quickAddInput } from '../validation'
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
    const db = getDb()
    const saved = await decks.saveCard(db, user.id, deckId, cardId, cardInput.parse(input))
    await revalidateCards(db, user.id, deckId)
    return ok({ id: saved.id })
  } catch (error) {
    return fail(error)
  }
}

// Reads what someone typed (and any pages it links to) into a draft for the
// card form. Nothing is saved: the form opens filled in for them to check
// (docs/quick-add.md).
export async function quickAddCard(deckId: string, text: string): Promise<ActionResult<CardDraft>> {
  const user = await requireUser()
  try {
    const db = getDb()
    await decks.getEditableDeck(db, user.id, deckId)
    const cards = (await decks.getDeckCards(db, deckId)).map(decks.toDateCard)
    // A new deck has no style of its own yet, so the starter cards stand in.
    const examples =
      cards.length > 0 ? cards : starterCards.map(({ title, description = '', tags }) => ({ title, description, tags }))
    const tags = [...new Set(examples.flatMap((card) => card.tags))].sort()
    return ok(await extractIdea(getCloudflareContext().env, { text: quickAddInput.parse(text), examples, tags }))
  } catch (error) {
    if (error instanceof QuickAddError) return { ok: false, error: error.message }
    return fail(error)
  }
}

export async function deleteCard(deckId: string, cardId: string): Promise<ActionResult> {
  const user = await requireUser()
  try {
    const db = getDb()
    await decks.deleteCard(db, user.id, deckId, cardId)
    await revalidateCards(db, user.id, deckId)
  } catch (error) {
    return fail(error)
  }
  return ok(undefined)
}

// Cards are changed from the deck's edit page and from the shared deck, and
// both show them (docs/card-notes.md § "Editing a card").
async function revalidateCards(db: Database, userId: string, deckId: string) {
  const { deck } = await decks.getEditableDeck(db, userId, deckId)
  revalidatePath(`/decks/${deckId}`)
  revalidatePath(`/d/${deck.shareId}`)
}

// A form action (bound to the share id), so asking works before the page's
// JavaScript loads. Lands back on the request page, which then says it's sent.
export async function requestEditAccess(shareId: string): Promise<void> {
  const requestPath = `/d/${encodeURIComponent(shareId)}/request`
  const user = await requireUser(requestPath)
  const db = getDb()
  let result: Awaited<ReturnType<typeof decks.requestEditAccess>>
  try {
    result = await decks.requestEditAccess(db, user.id, z.string().min(1).max(64).parse(shareId))
  } catch (error) {
    if (error instanceof decks.NotFoundError || error instanceof z.ZodError) notFound()
    throw error
  }

  if (result.created) {
    const { env } = getCloudflareContext()
    // The request is saved and shows on the deck's page either way, so a
    // failed email is logged rather than shown to the requester.
    try {
      await sendEmail(
        env,
        editRequestEmail(result.owner.email, {
          requester: { name: user.name, email: user.email },
          deckName: result.deck.name,
          url: new URL(`/decks/${result.deck.id}`, env.BETTER_AUTH_URL).href,
        }),
      )
    } catch (error) {
      console.error("Couldn't email the owner about an edit request", error)
    }
  }
  redirect(requestPath)
}

export async function respondToAccessRequest(deckId: string, userId: string, accept: boolean): Promise<ActionResult> {
  const user = await requireUser()
  try {
    await decks.respondToAccessRequest(getDb(), user.id, deckId, userId, accept)
  } catch (error) {
    return fail(error)
  }
  revalidatePath(`/decks/${deckId}`)
  return ok(undefined)
}

export async function removeEditor(deckId: string, userId: string): Promise<ActionResult> {
  const user = await requireUser()
  try {
    await decks.removeEditor(getDb(), user.id, deckId, userId)
  } catch (error) {
    return fail(error)
  }
  revalidatePath(`/decks/${deckId}`)
  return ok(undefined)
}

export async function leaveDeck(deckId: string): Promise<void> {
  const user = await requireUser()
  await decks.leaveDeck(getDb(), user.id, deckId)
  redirect('/decks')
}
