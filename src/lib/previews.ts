import { eq } from 'drizzle-orm'
import type { Database } from '@/db'
import { type Deck, deckPreview, planPreview } from '@/db/schema'
import { checkPreviewImage, MAX_PREVIEW_BYTES } from '@/lib/og/jpeg'
import type { PreviewInput } from '@/lib/og/preview'
import { previewKey } from '@/lib/og/preview-key'
import type { DateCard } from '@/types'
import type { getPlan } from './decks'

// The link preview pictures browsers draw and send (docs/share-previews.md
// § "Storing and serving"). The server never draws one; it only works out what
// a picture should show, keeps the latest one drawn, and hands it out.

export type PreviewKind = 'deck' | 'plan'

/** A picture a browser drew and sent, with the key of what it drew. */
export type SentPreview = { key: string; image: Blob }

/** A picture that isn't kept: out of date, or not a picture of the right kind. */
export class PreviewRejected extends Error {}

export function deckPreviewInput(deck: Pick<Deck, 'name'>, cards: DateCard[]): PreviewInput {
  return { title: deck.name, cards: cards.map(previewCard), layout: 'grid' }
}

// Every pick in plan order: the first row, then each group's.
export function planPreviewInput({ deck, cards, groups }: Awaited<ReturnType<typeof getPlan>>): PreviewInput {
  const picks = [...cards, ...groups.flatMap((group) => group.cards)]
  return { title: deck.name, cards: picks.map(previewCard), layout: 'fan' }
}

// Only what the picture shows, so a page doesn't send the browser more than it needs.
function previewCard({ id, title, date }: DateCard): PreviewInput['cards'][number] {
  return date ? { id, title, date } : { id, title }
}

/** What a deck or plan's picture shows now, and whether the one kept (if any) is of that. */
export async function previewState(db: Database, kind: PreviewKind, id: string, input: PreviewInput) {
  const key = previewKey(input)
  const stored = await getPreviewKey(db, kind, id)
  return { input, key, stored, stale: stored !== key }
}

export async function getPreviewKey(db: Database, kind: PreviewKind, id: string) {
  const [found] =
    kind === 'deck'
      ? await db.select({ key: deckPreview.key }).from(deckPreview).where(eq(deckPreview.deckId, id))
      : await db.select({ key: planPreview.key }).from(planPreview).where(eq(planPreview.planId, id))
  return found?.key ?? null
}

export async function getPreviewImage(db: Database, kind: PreviewKind, id: string) {
  const [found] =
    kind === 'deck'
      ? await db
          .select({ key: deckPreview.key, image: deckPreview.image })
          .from(deckPreview)
          .where(eq(deckPreview.deckId, id))
      : await db
          .select({ key: planPreview.key, image: planPreview.image })
          .from(planPreview)
          .where(eq(planPreview.planId, id))
  return found ?? null
}

export async function savePreview(db: Database, kind: PreviewKind, id: string, key: string, image: Uint8Array) {
  const values = { key, image: Buffer.from(image.buffer, image.byteOffset, image.byteLength), updatedAt: new Date() }
  if (kind === 'deck') {
    await db
      .insert(deckPreview)
      .values({ deckId: id, ...values })
      .onConflictDoUpdate({ target: deckPreview.deckId, set: values })
  } else {
    await db
      .insert(planPreview)
      .values({ planId: id, ...values })
      .onConflictDoUpdate({ target: planPreview.planId, set: values })
  }
}

/**
 * Keeps a picture a browser sent, if it's of what the deck or plan shows now
 * and is a 1200×630 JPEG (docs/share-previews.md § "Who can upload a
 * picture"). Whoever calls this has already checked the sender may.
 */
export async function keepPreview(db: Database, kind: PreviewKind, id: string, now: PreviewInput, sent: SentPreview) {
  if (typeof sent?.key !== 'string' || !(sent.image instanceof Blob)) throw new PreviewRejected('No picture was sent')
  if (sent.key !== previewKey(now)) throw new PreviewRejected('The picture is out of date')
  if (sent.image.size > MAX_PREVIEW_BYTES) throw new PreviewRejected('The picture is too big')
  const bytes = new Uint8Array(await sent.image.arrayBuffer())
  const problem = checkPreviewImage(bytes)
  if (problem) throw new PreviewRejected(problem)
  await savePreview(db, kind, id, sent.key, bytes)
}
