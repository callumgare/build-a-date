import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import PlanBuilder from '@/components/PlanBuilder'
import { getDb } from '@/db'
import { getSession } from '@/lib/auth'
import { getAccessState, getSharedDeck, listPlannedCardIds, listPlanSummaries, NotFoundError } from '@/lib/decks'
import { shareMetadata } from '@/lib/og/metadata'
import { previewAddress } from '@/lib/og/serve'
import { getDeckSort } from '@/lib/preferences'
import { deckPreviewInput, getPreviewKey } from '@/lib/previews'

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
  const stored = await getPreviewKey(getDb(), 'deck', deck.id)
  return shareMetadata({
    title: deck.name,
    description: `Pick your favourite date ideas from ${deck.name}.`,
    url: `/d/${deck.shareId}`,
    image: previewAddress(`/d/${deck.shareId}/preview`, stored),
  })
}

export default async function SharedDeck({ params }: PageProps<'/d/[shareId]'>) {
  // A new shuffle for every visit.
  await connection()
  const { deck, cards } = await findDeck((await params).shareId)
  const seed = Math.floor(Math.random() * 2 ** 32)
  const session = await getSession()
  const access = session ? await getAccessState(getDb(), session.user.id, deck) : 'none'
  const canEdit = access === 'owner' || access === 'editor'
  // Signed-in visitors start on the sort they last picked (docs/deck-sorting.md
  // § "Remembering the choice").
  const sort = session ? await getDeckSort(getDb(), session.user.id) : 'random'

  return (
    <PlanBuilder
      deckName={deck.name}
      shareId={deck.shareId}
      cards={cards}
      seed={seed}
      access={access}
      initialSort={sort}
      remembersSort={Boolean(session)}
      // The deck's own id only goes to people who can open its edit page.
      editHref={canEdit ? `/decks/${deck.id}` : undefined}
      deckId={canEdit ? deck.id : undefined}
      plans={canEdit ? await listPlanSummaries(getDb(), deck.id) : undefined}
      // The ideas the deck's saved plans have used, for anyone building
      // another one, so the Not in plan filter can hide them
      // (docs/deck-filters.md § "Not in plan").
      plannedCardIds={await listPlannedCardIds(getDb(), deck.id)}
      // Only they can change the deck, so only they redraw its link preview
      // (docs/share-previews.md § "When it's drawn").
      preview={
        canEdit
          ? {
              kind: 'deck',
              id: deck.id,
              input: deckPreviewInput(deck, cards),
              stored: await getPreviewKey(getDb(), 'deck', deck.id),
            }
          : undefined
      }
    />
  )
}
