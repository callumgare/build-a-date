import { sampleDeck } from '@/data/sample-deck'
import { previewContentType, previewSize, renderShareImage } from '@/lib/og/render'

export const size = previewSize
export const contentType = previewContentType
export const alt = 'The sample deck’s date ideas on a starry background'
// Drawn when it's asked for, like the others: at build time there's no
// Cloudflare context to load its fonts from.
export const dynamic = 'force-dynamic'

// The sample deck in a grid, as for a shared deck (docs/share-previews.md
// § "A deck").
export default function Image() {
  return renderShareImage({ title: sampleDeck.name, cards: sampleDeck.cards, layout: 'grid' })
}
