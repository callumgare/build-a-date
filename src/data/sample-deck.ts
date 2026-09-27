import type { DateCard } from '@/types'
import { starterCards } from './starter-cards'

// The deck behind "Try a sample deck", made of the starter ideas. It isn't in
// the database, so nothing done with it is saved (docs/sample-deck.md).
export const sampleDeck = {
  name: 'Sample Deck',
  // Only used to keep the picks in progress in this browser.
  shareId: 'sample',
  cards: starterCards.map(
    (card): DateCard => ({
      id: card.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, ''),
      title: card.title,
      description: card.description ?? '',
      tags: card.tags,
    }),
  ),
}
