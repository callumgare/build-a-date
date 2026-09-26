import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import ForgetPlanEdits from '@/components/ForgetPlanEdits'
import PlanView from '@/components/PlanView'
import SharePlanButton from '@/components/SharePlanButton'
import Stars from '@/components/Stars'
import { getDb } from '@/db'
import { getSession } from '@/lib/auth'
import { getAccessState, getPlan, getSharedDeck, NotFoundError } from '@/lib/decks'

async function findPlan(planId: string) {
  try {
    return await getPlan(getDb(), planId)
  } catch (error) {
    if (error instanceof NotFoundError) notFound()
    throw error
  }
}

export async function generateMetadata({ params }: PageProps<'/p/[planId]'>): Promise<Metadata> {
  const { deck } = await findPlan((await params).planId)
  return { title: `A plan from ${deck.name}` }
}

export default async function PlanPage({ params, searchParams }: PageProps<'/p/[planId]'>) {
  const { plan, deck, cards, groups } = await findPlan((await params).planId)
  // Done and Update Plan land here with ?share (docs/plans.md § "Sharing a plan").
  const justSaved = (await searchParams)?.share !== undefined
  const session = await getSession()
  const access = session ? await getAccessState(getDb(), session.user.id, deck) : 'none'
  // Owners and editors can change the cards from here, as on the shared deck
  // (docs/card-notes.md § "Editing a card"). The card form suggests the
  // deck's tags, not just the plan's.
  const canEdit = access === 'owner' || access === 'editor'
  const deckTags = canEdit
    ? [...new Set((await getSharedDeck(getDb(), deck.shareId)).cards.flatMap((card) => card.tags))].sort()
    : undefined

  return (
    <main className="page-shell">
      <ForgetPlanEdits planId={plan.id} />
      <Stars />
      <header className="hero">
        <h1>{deck.name}</h1>
      </header>

      <section className="plan-section" aria-label="The plan">
        <p className="lede">Here&apos;s the plan</p>
        <div className="plan-actions" data-visible="true">
          <SharePlanButton title={deck.name} openOnLoad={justSaved} />
          <Link className="text-action" href={`/p/${plan.id}/edit`}>
            Edit plan
          </Link>
          <Link className="text-action" href={`/d/${deck.shareId}`}>
            Create new plan
          </Link>
        </div>

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
