import type { Metadata } from 'next'
import { connection } from 'next/server'
import PlanBuilder from '@/components/PlanBuilder'
import { sampleDeck } from '@/data/sample-deck'
import { shareMetadata } from '@/lib/og/metadata'

export function generateMetadata(): Metadata {
  return shareMetadata({
    title: 'Sample deck',
    description: 'Try Build-a-Date by picking some date ideas from a sample deck.',
    url: '/sample',
    // Drawn once and kept in public/og/ (docs/share-previews.md § "The static pictures").
    image: '/og/sample.jpg',
  })
}

// The builder for the sample deck, with nothing to save it to
// (docs/sample-deck.md).
export default async function SampleDeck() {
  // A new shuffle for every visit, as on a shared deck.
  await connection()
  const seed = Math.floor(Math.random() * 2 ** 32)

  return (
    <PlanBuilder deckName={sampleDeck.name} shareId={sampleDeck.shareId} cards={sampleDeck.cards} seed={seed} sample />
  )
}
