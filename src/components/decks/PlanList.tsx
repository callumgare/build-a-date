import Button from '../ui/Button'
import { Subheading } from '../ui/Heading'
import { ItemList, ItemRow } from '../ui/ItemList'
import Muted from '../ui/Muted'

export type PlanSummary = { id: string; createdAt: Date; cards: number }

// The plans built from a deck, newest first, for its owner and editors: on the
// deck's page and on the shared deck (docs/deck-sharing.md § "Who can do
// what").
export default function PlanList({ plans }: { plans: PlanSummary[] }) {
  return (
    <>
      <Subheading count={plans.length}>Plans</Subheading>
      {plans.length === 0 ? (
        <Muted as="p">When someone builds a plan from your link and presses Save plan, it shows up here.</Muted>
      ) : (
        <ItemList>
          {plans.map((plan) => (
            <ItemRow key={plan.id}>
              <Button variant="text" href={`/p/${plan.id}`} native>
                {/* Formatted in the viewer's time zone once in the browser. */}
                <time dateTime={plan.createdAt.toISOString()} suppressHydrationWarning>
                  {plan.createdAt.toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </time>
              </Button>
              <Muted>
                {plan.cards} {plan.cards === 1 ? 'idea' : 'ideas'}
              </Muted>
            </ItemRow>
          ))}
        </ItemList>
      )}
    </>
  )
}
