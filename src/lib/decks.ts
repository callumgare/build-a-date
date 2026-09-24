import { and, asc, count, desc, eq, inArray, max } from 'drizzle-orm'
import { customAlphabet, nanoid } from 'nanoid'
import { starterCards } from '@/data/starter-cards'
import type { Database } from '@/db'
import { type CardRow, card, deck, plan } from '@/db/schema'
import type { DateCard } from '@/types'
import { type CardInput, cardInput } from './validation'

// Short, unambiguous ids for the links people share.
const shareCode = customAlphabet('23456789abcdefghjkmnpqrstuvwxyz', 10)

// D1 caps a statement at 100 bound values, and a card insert binds 7 each.
const insertChunk = 12

export class NotFoundError extends Error {}

export function toDateCard(row: CardRow): DateCard {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    tags: row.tags,
    ...(row.date ? { date: row.date } : {}),
  }
}

export async function listDecks(db: Database, ownerId: string) {
  const cardCounts = db
    .select({ deckId: card.deckId, cards: count().as('cards') })
    .from(card)
    .groupBy(card.deckId)
    .as('card_counts')
  const planCounts = db
    .select({ deckId: plan.deckId, plans: count().as('plans') })
    .from(plan)
    .groupBy(plan.deckId)
    .as('plan_counts')

  const rows = await db
    .select({ deck, cards: cardCounts.cards, plans: planCounts.plans })
    .from(deck)
    .leftJoin(cardCounts, eq(cardCounts.deckId, deck.id))
    .leftJoin(planCounts, eq(planCounts.deckId, deck.id))
    .where(eq(deck.ownerId, ownerId))
    .orderBy(desc(deck.updatedAt))

  return rows.map((row) => ({
    ...row.deck,
    cards: row.cards ?? 0,
    plans: row.plans ?? 0,
  }))
}

// Only ever finds the deck for its owner, so every owner action goes through
// here first.
export async function getOwnedDeck(db: Database, ownerId: string, deckId: string) {
  const [found] = await db
    .select()
    .from(deck)
    .where(and(eq(deck.id, deckId), eq(deck.ownerId, ownerId)))
  if (!found) throw new NotFoundError('Deck not found')
  return found
}

export async function getDeckCards(db: Database, deckId: string) {
  return db.select().from(card).where(eq(card.deckId, deckId)).orderBy(asc(card.position), asc(card.createdAt))
}

export async function createDeck(
  db: Database,
  ownerId: string,
  { name, template }: { name: string; template: 'empty' | 'suggestions' },
) {
  const [created] = await db.insert(deck).values({ id: nanoid(), ownerId, name, shareId: shareCode() }).returning()

  if (template === 'suggestions') {
    const rows = starterCards.map((starter, position) => ({
      ...cardInput.parse(starter),
      id: nanoid(),
      deckId: created.id,
      position,
    }))
    for (let start = 0; start < rows.length; start += insertChunk) {
      await db.insert(card).values(rows.slice(start, start + insertChunk))
    }
  }

  return created
}

export async function renameDeck(db: Database, ownerId: string, deckId: string, name: string) {
  await getOwnedDeck(db, ownerId, deckId)
  await db.update(deck).set({ name }).where(eq(deck.id, deckId))
}

export async function deleteDeck(db: Database, ownerId: string, deckId: string) {
  await getOwnedDeck(db, ownerId, deckId)
  await db.delete(deck).where(eq(deck.id, deckId))
}

// Marks the deck as changed, so the dashboard lists recently edited decks
// first.
async function touchDeck(db: Database, deckId: string) {
  await db.update(deck).set({ updatedAt: new Date() }).where(eq(deck.id, deckId))
}

export async function saveCard(db: Database, ownerId: string, deckId: string, cardId: string | null, input: CardInput) {
  await getOwnedDeck(db, ownerId, deckId)
  const values = cardInput.parse(input)

  let saved: CardRow | undefined
  if (cardId) {
    ;[saved] = await db
      .update(card)
      .set(values)
      .where(and(eq(card.id, cardId), eq(card.deckId, deckId)))
      .returning()
    if (!saved) throw new NotFoundError('Card not found')
  } else {
    const [{ last }] = await db
      .select({ last: max(card.position) })
      .from(card)
      .where(eq(card.deckId, deckId))
    ;[saved] = await db
      .insert(card)
      .values({ ...values, id: nanoid(), deckId, position: (last ?? -1) + 1 })
      .returning()
  }

  await touchDeck(db, deckId)
  return saved
}

export async function deleteCard(db: Database, ownerId: string, deckId: string, cardId: string) {
  await getOwnedDeck(db, ownerId, deckId)
  await db.delete(card).where(and(eq(card.id, cardId), eq(card.deckId, deckId)))
  await touchDeck(db, deckId)
}

export async function getSharedDeck(db: Database, shareId: string) {
  const [found] = await db.select().from(deck).where(eq(deck.shareId, shareId))
  if (!found) throw new NotFoundError('Deck not found')
  const cards = await getDeckCards(db, found.id)
  return { deck: found, cards: cards.map(toDateCard) }
}

// Anyone with the share link can save a plan. Only cards from that deck are
// kept, in the order given, without repeats.
export async function savePlan(db: Database, shareId: string, cardIds: string[]) {
  const [found] = await db.select({ id: deck.id }).from(deck).where(eq(deck.shareId, shareId))
  if (!found) throw new NotFoundError('Deck not found')

  const inDeck = new Set(
    (
      await db
        .select({ id: card.id })
        .from(card)
        .where(and(eq(card.deckId, found.id), inArray(card.id, cardIds)))
    ).map((row) => row.id),
  )
  const kept = [...new Set(cardIds)].filter((id) => inDeck.has(id))
  if (kept.length === 0) throw new NotFoundError('None of those cards are in this deck')

  const [saved] = await db.insert(plan).values({ id: shareCode(), deckId: found.id, cardIds: kept }).returning()
  return saved
}

// A plan's cards in the order they were picked, leaving out any since deleted.
export async function getPlan(db: Database, planId: string) {
  const [found] = await db
    .select({ plan, deck })
    .from(plan)
    .innerJoin(deck, eq(deck.id, plan.deckId))
    .where(eq(plan.id, planId))
  if (!found) throw new NotFoundError('Plan not found')

  const rows = found.plan.cardIds.length
    ? await db
        .select()
        .from(card)
        .where(and(eq(card.deckId, found.deck.id), inArray(card.id, found.plan.cardIds)))
    : []
  const byId = new Map(rows.map((row) => [row.id, toDateCard(row)]))
  const cards = found.plan.cardIds.flatMap((id) => byId.get(id) ?? [])

  return { plan: found.plan, deck: found.deck, cards }
}

export async function listPlans(db: Database, deckId: string) {
  return db.select().from(plan).where(eq(plan.deckId, deckId)).orderBy(desc(plan.createdAt))
}
