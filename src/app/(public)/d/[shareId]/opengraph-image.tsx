import { notFound } from 'next/navigation'
import { getDb } from '@/db'
import { getSharedDeck, NotFoundError } from '@/lib/decks'
import { previewContentType, previewSize, renderShareImage } from '@/lib/og/render'

export const size = previewSize
export const contentType = previewContentType
export const alt = 'The deck’s date ideas on a starry background'

// The deck's name with its cards in a grid below, for a shared link
// (docs/share-previews.md § "A deck"). In the deck's own order, not shuffled,
// so the picture is the same each time it's fetched.
export default async function Image({ params }: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await params
  try {
    const { deck, cards } = await getSharedDeck(getDb(), shareId)
    return await renderShareImage({ title: deck.name, cards, layout: 'grid' })
  } catch (error) {
    if (error instanceof NotFoundError) notFound()
    throw error
  }
}
