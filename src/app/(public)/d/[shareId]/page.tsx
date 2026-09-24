import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import DeckBuilder from '@/components/DeckBuilder'
import { getDb } from '@/db'
import { getSharedDeck, NotFoundError } from '@/lib/decks'

async function findDeck(shareId: string) {
  try {
    return await getSharedDeck(getDb(), shareId)
  } catch (error) {
    if (error instanceof NotFoundError) notFound()
    throw error
  }
}

export async function generateMetadata({ params }: PageProps<'/d/[shareId]'>): Promise<Metadata> {
  const { deck } = await findDeck((await params).shareId)
  return {
    title: deck.name,
    description: `Pick your favourite date ideas from ${deck.name}.`,
  }
}

export default async function SharedDeck({ params }: PageProps<'/d/[shareId]'>) {
  // A new shuffle for every visit.
  await connection()
  const { deck, cards } = await findDeck((await params).shareId)
  const seed = Math.floor(Math.random() * 2 ** 32)

  return <DeckBuilder deckName={deck.name} shareId={deck.shareId} cards={cards} seed={seed} />
}
