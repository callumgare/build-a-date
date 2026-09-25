export type PlanSummary = { id: string; createdAt: Date; cards: number }

// The plans built from a deck, newest first, for its owner and editors: on the
// deck's page and on the shared deck (docs/deck-sharing.md § "Who can do
// what").
export default function PlanList({ plans }: { plans: PlanSummary[] }) {
  return (
    <>
      <h3 className="subheading">
        Plans <small>({plans.length})</small>
      </h3>
      {plans.length === 0 ? (
        <p className="muted">When someone builds a plan from your link and presses Done, it shows up here.</p>
      ) : (
        <ul className="plan-list">
          {plans.map((plan) => (
            <li key={plan.id}>
              <a className="text-action" href={`/p/${plan.id}`}>
                {/* Formatted in the viewer's time zone once in the browser. */}
                <time dateTime={plan.createdAt.toISOString()} suppressHydrationWarning>
                  {plan.createdAt.toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </time>
              </a>
              <span className="muted">
                {plan.cards} {plan.cards === 1 ? 'idea' : 'ideas'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
