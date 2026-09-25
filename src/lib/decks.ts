import { and, asc, count, desc, eq, inArray, max } from 'drizzle-orm'
import { customAlphabet, nanoid } from 'nanoid'
import { starterCards } from '@/data/starter-cards'
import type { Database } from '@/db'
import { type CardRow, card, type Deck, deck, deckAccess, plan, user } from '@/db/schema'
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
    ...(row.interest ? { interest: row.interest } : {}),
    ...(row.notes ? { notes: row.notes } : {}),
    addedAt: row.createdAt.toISOString(),
  }
}

function deckCounts(db: Database) {
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
  return { cardCounts, planCounts }
}

export async function listDecks(db: Database, ownerId: string) {
  const { cardCounts, planCounts } = deckCounts(db)
  const requestCounts = db
    .select({ deckId: deckAccess.deckId, requests: count().as('requests') })
    .from(deckAccess)
    .where(eq(deckAccess.status, 'pending'))
    .groupBy(deckAccess.deckId)
    .as('request_counts')

  const rows = await db
    .select({ deck, cards: cardCounts.cards, plans: planCounts.plans, requests: requestCounts.requests })
    .from(deck)
    .leftJoin(cardCounts, eq(cardCounts.deckId, deck.id))
    .leftJoin(planCounts, eq(planCounts.deckId, deck.id))
    .leftJoin(requestCounts, eq(requestCounts.deckId, deck.id))
    .where(eq(deck.ownerId, ownerId))
    .orderBy(desc(deck.updatedAt))

  return rows.map((row) => ({
    ...row.deck,
    cards: row.cards ?? 0,
    plans: row.plans ?? 0,
    requests: row.requests ?? 0,
  }))
}

// Other people's decks this user has been let in to edit.
export async function listSharedDecks(db: Database, userId: string) {
  const { cardCounts, planCounts } = deckCounts(db)

  const rows = await db
    .select({ deck, ownerName: user.name, cards: cardCounts.cards, plans: planCounts.plans })
    .from(deckAccess)
    .innerJoin(deck, eq(deck.id, deckAccess.deckId))
    .innerJoin(user, eq(user.id, deck.ownerId))
    .leftJoin(cardCounts, eq(cardCounts.deckId, deck.id))
    .leftJoin(planCounts, eq(planCounts.deckId, deck.id))
    .where(and(eq(deckAccess.userId, userId), eq(deckAccess.status, 'accepted')))
    .orderBy(desc(deck.updatedAt))

  return rows.map((row) => ({
    ...row.deck,
    ownerName: row.ownerName,
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

export type DeckRole = 'owner' | 'editor'

// Finds the deck for its owner or anyone they've let in, so every card edit
// goes through here first. Owner-only actions use getOwnedDeck instead
// (docs/deck-sharing.md § "Who can do what").
export async function getEditableDeck(db: Database, userId: string, deckId: string) {
  const [found] = await db
    .select({ deck, access: deckAccess.status })
    .from(deck)
    .leftJoin(deckAccess, and(eq(deckAccess.deckId, deck.id), eq(deckAccess.userId, userId)))
    .where(eq(deck.id, deckId))
  if (found?.deck.ownerId === userId) return { deck: found.deck, role: 'owner' as DeckRole }
  if (found?.access === 'accepted') return { deck: found.deck, role: 'editor' as DeckRole }
  throw new NotFoundError('Deck not found')
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

export async function saveCard(db: Database, userId: string, deckId: string, cardId: string | null, input: CardInput) {
  await getEditableDeck(db, userId, deckId)
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

export async function deleteCard(db: Database, userId: string, deckId: string, cardId: string) {
  await getEditableDeck(db, userId, deckId)
  await db.delete(card).where(and(eq(card.id, cardId), eq(card.deckId, deckId)))
  await touchDeck(db, deckId)
}

export async function getSharedDeck(db: Database, shareId: string) {
  const [found] = await db.select().from(deck).where(eq(deck.shareId, shareId))
  if (!found) throw new NotFoundError('Deck not found')
  const cards = await getDeckCards(db, found.id)
  return { deck: found, cards: cards.map(toDateCard) }
}

// Anyone with the share link can rate a card and write notes on it. There's
// one rating and one set of notes per card, so this replaces both
// (docs/card-notes.md § "Who can change them").
export async function saveCardNotes(
  db: Database,
  shareId: string,
  cardId: string,
  { interest, notes }: { interest: number | null; notes: string },
) {
  const [found] = await db.select({ id: deck.id }).from(deck).where(eq(deck.shareId, shareId))
  if (!found) throw new NotFoundError('Deck not found')
  const [saved] = await db
    .update(card)
    .set({ interest, notes })
    .where(and(eq(card.id, cardId), eq(card.deckId, found.id)))
    .returning()
  if (!saved) throw new NotFoundError('Card not found')
  return saved
}

// Only cards from the deck are kept, in the order given, without repeats.
async function keepDeckCards(db: Database, deckId: string, cardIds: string[]) {
  const inDeck = new Set(
    (
      await db
        .select({ id: card.id })
        .from(card)
        .where(and(eq(card.deckId, deckId), inArray(card.id, cardIds)))
    ).map((row) => row.id),
  )
  const kept = [...new Set(cardIds)].filter((id) => inDeck.has(id))
  if (kept.length === 0) throw new NotFoundError('None of those cards are in this deck')
  return kept
}

// Anyone with the share link can save a plan.
export async function savePlan(db: Database, shareId: string, cardIds: string[]) {
  const [found] = await db.select({ id: deck.id }).from(deck).where(eq(deck.shareId, shareId))
  if (!found) throw new NotFoundError('Deck not found')
  const kept = await keepDeckCards(db, found.id, cardIds)
  const [saved] = await db.insert(plan).values({ id: shareCode(), deckId: found.id, cardIds: kept }).returning()
  return saved
}

// Anyone with a plan's link can change its cards, and the link stays the same
// (docs/plans.md § "Who can edit a plan").
export async function updatePlan(db: Database, planId: string, cardIds: string[]) {
  const [found] = await db.select({ deckId: plan.deckId }).from(plan).where(eq(plan.id, planId))
  if (!found) throw new NotFoundError('Plan not found')
  const kept = await keepDeckCards(db, found.deckId, cardIds)
  const [saved] = await db.update(plan).set({ cardIds: kept }).where(eq(plan.id, planId)).returning()
  return saved
}

// Anyone with a plan's link can delete it, as they can edit it (docs/plans.md
// § "Who can edit a plan").
export async function deletePlan(db: Database, planId: string) {
  const [deleted] = await db.delete(plan).where(eq(plan.id, planId)).returning({ id: plan.id })
  if (!deleted) throw new NotFoundError('Plan not found')
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

// The deck's plans as its owner and editors see them listed, newest first.
// Callers check who's asking first (docs/deck-sharing.md § "Who can do what").
export async function listPlanSummaries(db: Database, deckId: string) {
  return (await listPlans(db, deckId)).map((row) => ({
    id: row.id,
    createdAt: row.createdAt,
    cards: row.cardIds.length,
  }))
}

// What someone looking at a shared deck can do with it besides build a plan.
export type AccessState = DeckRole | 'pending' | 'none'

export async function getAccessState(db: Database, userId: string, found: Deck): Promise<AccessState> {
  if (found.ownerId === userId) return 'owner'
  const [access] = await db
    .select({ status: deckAccess.status })
    .from(deckAccess)
    .where(and(eq(deckAccess.deckId, found.id), eq(deckAccess.userId, userId)))
  if (!access) return 'none'
  return access.status === 'accepted' ? 'editor' : 'pending'
}

// A shared deck with who owns it, for asking them for edit access.
export async function getSharedDeckWithOwner(db: Database, shareId: string) {
  const [found] = await db
    .select({ deck, owner: { name: user.name, email: user.email } })
    .from(deck)
    .innerJoin(user, eq(user.id, deck.ownerId))
    .where(eq(deck.shareId, shareId))
  if (!found) throw new NotFoundError('Deck not found')
  return found
}

// Asks the owner to let this user edit the deck. Asking again, or asking for
// a deck you already own or edit, changes nothing; `created` says whether
// this was a new request, so the owner is only told once.
export async function requestEditAccess(db: Database, userId: string, shareId: string) {
  const found = await getSharedDeckWithOwner(db, shareId)
  if (found.deck.ownerId === userId) return { ...found, created: false }
  const inserted = await db
    .insert(deckAccess)
    .values({ deckId: found.deck.id, userId, status: 'pending' })
    .onConflictDoNothing()
    .returning()
  return { ...found, created: inserted.length > 0 }
}

// Everyone who has asked for or been given edit access, oldest first.
export async function listDeckAccess(db: Database, ownerId: string, deckId: string) {
  await getOwnedDeck(db, ownerId, deckId)
  return db
    .select({
      userId: deckAccess.userId,
      name: user.name,
      email: user.email,
      status: deckAccess.status,
      createdAt: deckAccess.createdAt,
    })
    .from(deckAccess)
    .innerJoin(user, eq(user.id, deckAccess.userId))
    .where(eq(deckAccess.deckId, deckId))
    .orderBy(asc(deckAccess.createdAt))
}

// Accepting lets them edit; declining deletes the request, so they can ask
// again later.
export async function respondToAccessRequest(
  db: Database,
  ownerId: string,
  deckId: string,
  userId: string,
  accept: boolean,
) {
  await getOwnedDeck(db, ownerId, deckId)
  const request = and(eq(deckAccess.deckId, deckId), eq(deckAccess.userId, userId), eq(deckAccess.status, 'pending'))
  const changed = accept
    ? await db.update(deckAccess).set({ status: 'accepted' }).where(request).returning()
    : await db.delete(deckAccess).where(request).returning()
  if (changed.length === 0) throw new NotFoundError('That request has already been answered')
}

export async function removeEditor(db: Database, ownerId: string, deckId: string, userId: string) {
  await getOwnedDeck(db, ownerId, deckId)
  await db.delete(deckAccess).where(and(eq(deckAccess.deckId, deckId), eq(deckAccess.userId, userId)))
}

// An editor taking themselves off someone else's deck.
export async function leaveDeck(db: Database, userId: string, deckId: string) {
  await db.delete(deckAccess).where(and(eq(deckAccess.deckId, deckId), eq(deckAccess.userId, userId)))
}
