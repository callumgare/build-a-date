import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import DeckBuilder from '@/components/DeckBuilder'
import { getDb } from '@/db'
import { getSession } from '@/lib/auth'
import { getAccessState, getSharedDeck, NotFoundError } from '@/lib/decks'

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
  const session = await getSession()
  const access = session ? await getAccessState(getDb(), session.user.id, deck) : 'none'
  const canEdit = access === 'owner' || access === 'editor'

  return (
    <DeckBuilder
      deckName={deck.name}
      shareId={deck.shareId}
      cards={cards}
      seed={seed}
      access={access}
      // The deck's own id only goes to people who can open its edit page.
      editHref={canEdit ? `/decks/${deck.id}` : undefined}
      deckId={canEdit ? deck.id : undefined}
    />
  )
}
