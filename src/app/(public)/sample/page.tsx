import type { Metadata } from 'next'
import { connection } from 'next/server'
import PlanBuilder from '@/components/PlanBuilder'
import { sampleDeck } from '@/data/sample-deck'

export const metadata: Metadata = {
  title: 'Sample deck',
  description: 'Try Build-a-Date by picking some date ideas from a sample deck.',
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
