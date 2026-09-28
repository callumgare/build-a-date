import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import ForgetPlanEdits from '@/components/ForgetPlanEdits'
import PlanView from '@/components/PlanView'
import SharePlanButton from '@/components/SharePlanButton'
import SharePreviewRefresher from '@/components/SharePreviewRefresher'
import Stars from '@/components/Stars'
import { getDb } from '@/db'
import { getSession } from '@/lib/auth'
import { getAccessState, getPlan, getSharedDeck, NotFoundError } from '@/lib/decks'
import { shareMetadata } from '@/lib/og/metadata'
import { previewAddress } from '@/lib/og/serve'
import { deckPreviewInput, getPreviewKey, planPreviewInput } from '@/lib/previews'

async function findPlan(planId: string) {
  try {
    return await getPlan(getDb(), planId)
  } catch (error) {
    if (error instanceof NotFoundError) notFound()
    throw error
  }
}

export async function generateMetadata({ params }: PageProps<'/p/[planId]'>): Promise<Metadata> {
  const { plan, deck } = await findPlan((await params).planId)
  return shareMetadata({
    title: `A plan from ${deck.name}`,
    description: `The date ideas picked from ${deck.name}.`,
    image: previewAddress(`/p/${plan.id}/preview`, await getPreviewKey(getDb(), 'plan', plan.id)),
  })
}

export default async function PlanPage({ params, searchParams }: PageProps<'/p/[planId]'>) {
  const found = await findPlan((await params).planId)
  const { plan, deck, cards, groups } = found
  // Save plan lands here with ?share (docs/plans.md § "Sharing a plan").
  const justSaved = (await searchParams)?.share !== undefined
  const session = await getSession()
  const access = session ? await getAccessState(getDb(), session.user.id, deck) : 'none'
  // Owners and editors can change the cards from here, as on the shared deck
  // (docs/card-notes.md § "Editing a card"). The card form suggests the
  // deck's tags, not just the plan's.
  const canEdit = access === 'owner' || access === 'editor'
  const deckCards = canEdit ? (await getSharedDeck(getDb(), deck.shareId)).cards : undefined
  const deckTags = deckCards ? [...new Set(deckCards.flatMap((card) => card.tags))].sort() : undefined

  return (
    <main className="page-shell">
      <ForgetPlanEdits planId={plan.id} />
      {/* Anyone with the link can change the plan, so anyone can redraw its
          link preview (docs/share-previews.md § "When it's drawn"). */}
      <SharePreviewRefresher
        kind="plan"
        id={plan.id}
        input={planPreviewInput(found)}
        stored={await getPreviewKey(getDb(), 'plan', plan.id)}
      />
      {/* A card changed from here can change the deck's picture too, and only
          owners and editors can change cards, or redraw it. */}
      {deckCards && (
        <SharePreviewRefresher
          kind="deck"
          id={deck.id}
          input={deckPreviewInput(deck, deckCards)}
          stored={await getPreviewKey(getDb(), 'deck', deck.id)}
        />
      )}
      <Stars />
      <header className="hero">
        <h1>{deck.name}</h1>
        <p className="lede">Here&apos;s the plan</p>
      </header>

      {/* Laid out as the builder's bar is, so the title, the words under it
          and the buttons are spaced the same as when editing the plan. */}
      <div className="builder-bar plan-page-bar">
        <div className="plan-actions" data-visible="true">
          <SharePlanButton title={deck.name} openOnLoad={justSaved} />
          <Link className="text-action" href={`/p/${plan.id}/edit`}>
            Edit plan
          </Link>
          <Link className="text-action" href={`/d/${deck.shareId}`}>
            Create new plan
          </Link>
        </div>
      </div>

      <section className="plan-section" aria-label="The plan">
        {cards.length === 0 && groups.every((group) => group.cards.length === 0) ? (
          <p className="empty-results">The ideas in this plan have since been removed from the deck.</p>
        ) : (
          <PlanView
            shareId={deck.shareId}
            cards={cards}
            groups={groups}
            deckId={canEdit ? deck.id : undefined}
            deckTags={deckTags}
          />
        )}
      </section>
    </main>
  )
}
