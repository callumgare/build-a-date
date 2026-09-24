import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import DeckEditor from '@/components/decks/DeckEditor'
import { getDb } from '@/db'
import { requireUser } from '@/lib/auth'
import { getDeckCards, getEditableDeck, listDeckAccess, listPlans, NotFoundError, toDateCard } from '@/lib/decks'

async function findDeck(deckId: string) {
  const user = await requireUser()
  try {
    return { ...(await getEditableDeck(getDb(), user.id, deckId)), user }
  } catch (error) {
    if (error instanceof NotFoundError) notFound()
    throw error
  }
}

export async function generateMetadata({ params }: PageProps<'/decks/[deckId]'>): Promise<Metadata> {
  const { deck } = await findDeck((await params).deckId)
  return { title: deck.name }
}

export default async function DeckPage({ params }: PageProps<'/decks/[deckId]'>) {
  const { deck, role, user } = await findDeck((await params).deckId)
  const [cards, plans, access] = await Promise.all([
    getDeckCards(getDb(), deck.id),
    listPlans(getDb(), deck.id),
    // Only the owner sees who else can edit, and answers requests.
    role === 'owner' ? listDeckAccess(getDb(), user.id, deck.id) : [],
  ])

  return (
    <DeckEditor
      deck={{ id: deck.id, name: deck.name, shareId: deck.shareId }}
      role={role}
      access={access.map(({ userId, name, email, status }) => ({ userId, name, email, status }))}
      shareUrl={new URL(`/d/${deck.shareId}`, getCloudflareContext().env.BETTER_AUTH_URL).href}
      cards={cards.map(toDateCard)}
      plans={plans.map((plan) => ({
        id: plan.id,
        createdAt: plan.createdAt,
        cards: plan.cardIds.length,
      }))}
    />
  )
}
