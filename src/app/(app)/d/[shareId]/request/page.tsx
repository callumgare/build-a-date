import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getDb } from '@/db'
import { requestEditAccess } from '@/lib/actions/decks'
import { requireUser } from '@/lib/auth'
import { getAccessState, getSharedDeckWithOwner, NotFoundError } from '@/lib/decks'

export const metadata: Metadata = { title: 'Request edit access' }

// Where "Request edit access" on a shared deck leads, by way of signing in if
// needed. Sending the request takes a press here rather than happening on
// arrival, so a link someone else crafted can't send one in your name
// (docs/deck-sharing.md § "Why sending takes a press").
export default async function RequestAccess({ params }: PageProps<'/d/[shareId]/request'>) {
  const { shareId } = await params
  const user = await requireUser(`/d/${encodeURIComponent(shareId)}/request`)
  const db = getDb()

  let found: Awaited<ReturnType<typeof getSharedDeckWithOwner>>
  try {
    found = await getSharedDeckWithOwner(db, shareId)
  } catch (error) {
    if (error instanceof NotFoundError) notFound()
    throw error
  }
  const state = await getAccessState(db, user.id, found.deck)
  if (state === 'owner' || state === 'editor') redirect(`/decks/${found.deck.id}`)

  return (
    <section className="panel narrow">
      <h2>{found.deck.name}</h2>
      {state === 'pending' ? (
        <p role="status">
          You&apos;ve asked to edit this deck. Once its owner says yes, it&apos;ll show up under Shared decks on{' '}
          <Link href="/decks">your decks</Link>.
        </p>
      ) : (
        <>
          <p>
            Ask the deck&apos;s owner to let you add and edit its ideas. We&apos;ll email them your name and email
            address so they know who&apos;s asking.
          </p>
          <form className="form" action={requestEditAccess.bind(null, shareId)}>
            <button className="done-button" type="submit">
              Send request
            </button>
          </form>
        </>
      )}
      <p className="panel-footnote">
        <Link href={`/d/${shareId}`}>Back to the deck</Link>
      </p>
    </section>
  )
}
