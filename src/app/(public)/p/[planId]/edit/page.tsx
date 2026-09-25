import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import DeckBuilder from '@/components/DeckBuilder'
import { getDb } from '@/db'
import { getSession } from '@/lib/auth'
import { getAccessState, getPlan, getSharedDeck, listPlanSummaries, NotFoundError } from '@/lib/decks'
import { getDeckSort } from '@/lib/preferences'

async function findPlan(planId: string) {
  try {
    const { plan, deck } = await getPlan(getDb(), planId)
    const { cards } = await getSharedDeck(getDb(), deck.shareId)
    return { plan, deck, cards }
  } catch (error) {
    if (error instanceof NotFoundError) notFound()
    throw error
  }
}

export async function generateMetadata({ params }: PageProps<'/p/[planId]/edit'>): Promise<Metadata> {
  const { deck } = await findPlan((await params).planId)
  return { title: `Edit a plan from ${deck.name}` }
}

// The builder, starting from a saved plan, which Done saves over
// (docs/plans.md § "Editing a plan"). Anyone with the plan's link can.
export default async function EditPlan({ params }: PageProps<'/p/[planId]/edit'>) {
  // A new shuffle for every visit, as on the shared deck.
  await connection()
  const { plan, deck, cards } = await findPlan((await params).planId)
  const seed = Math.floor(Math.random() * 2 ** 32)
  const session = await getSession()
  const access = session ? await getAccessState(getDb(), session.user.id, deck) : 'none'
  const canEdit = access === 'owner' || access === 'editor'
  const sort = session ? await getDeckSort(getDb(), session.user.id) : 'random'
  // Cards deleted since the plan was saved have already dropped out.
  const inDeck = new Set(cards.map((card) => card.id))

  return (
    <DeckBuilder
      deckName={deck.name}
      shareId={deck.shareId}
      cards={cards}
      seed={seed}
      access={access}
      initialSort={sort}
      remembersSort={Boolean(session)}
      editHref={canEdit ? `/decks/${deck.id}` : undefined}
      deckId={canEdit ? deck.id : undefined}
      plans={canEdit ? await listPlanSummaries(getDb(), deck.id) : undefined}
      plan={{ id: plan.id, cardIds: plan.cardIds.filter((id) => inDeck.has(id)) }}
    />
  )
}
