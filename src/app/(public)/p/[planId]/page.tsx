import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Card from '@/components/Card'
import cardStyles from '@/components/Card.module.css'
import { frameFor } from '@/components/frames'
import SharePlanButton from '@/components/SharePlanButton'
import Stars from '@/components/Stars'
import { getDb } from '@/db'
import { getPlan, NotFoundError } from '@/lib/decks'

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

export default async function PlanPage({ params }: PageProps<'/p/[planId]'>) {
  const { deck, cards } = await findPlan((await params).planId)

  return (
    <main className="page-shell">
      <Stars />
      <header className="hero">
        <h1>{deck.name}</h1>
      </header>

      <section className="plan-section" aria-label="The plan">
        <p className="lede">Here&apos;s the plan</p>
        <div className="plan-actions" data-visible="true">
          <SharePlanButton title={deck.name} />
          <Link className="text-action" href={`/d/${deck.shareId}`}>
            Build your own plan
          </Link>
        </div>

        {cards.length === 0 ? (
          <p className="empty-results">The ideas in this plan have since been removed from the deck.</p>
        ) : (
          <div className="plan-track">
            {cards.map((card) => (
              <div className={cardStyles.card} key={card.id}>
                <Card card={card} frame={frameFor(card.id)} />
              </div>
            ))}
          </div>
        )}
      </section>

      <footer className="site-footer">
        <Link className="text-action" href="/">
          Make your own deck with Build-a-Date
        </Link>
      </footer>
    </main>
  )
}
