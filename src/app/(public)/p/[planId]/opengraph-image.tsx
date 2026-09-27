import { notFound } from 'next/navigation'
import { getDb } from '@/db'
import { getPlan, NotFoundError } from '@/lib/decks'
import { previewContentType, previewSize, renderShareImage } from '@/lib/og/render'

export const size = previewSize
export const contentType = previewContentType
export const alt = 'The date ideas picked for this plan, fanned out like a hand of cards'

// The deck's name with the plan's picks fanned out below, for a shared link
// (docs/share-previews.md § "A plan"): every pick in plan order, the first
// row and then each group's.
export default async function Image({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params
  try {
    const { deck, cards, groups } = await getPlan(getDb(), planId)
    const picks = [...cards, ...groups.flatMap((group) => group.cards)]
    return await renderShareImage({ title: deck.name, cards: picks, layout: 'fan' })
  } catch (error) {
    if (error instanceof NotFoundError) notFound()
    throw error
  }
}
