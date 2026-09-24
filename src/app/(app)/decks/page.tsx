import type { Metadata } from 'next'
import Link from 'next/link'
import NewDeckButton from '@/components/decks/NewDeckButton'
import { getDb } from '@/db'
import { requireUser } from '@/lib/auth'
import { listDecks, listSharedDecks } from '@/lib/decks'

export const metadata: Metadata = { title: 'Your decks' }

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

export default async function Decks() {
  const user = await requireUser()
  const [decks, sharedDecks] = await Promise.all([listDecks(getDb(), user.id), listSharedDecks(getDb(), user.id)])

  return (
    <section className="app-section">
      <div className="section-heading">
        <h2>Your decks</h2>
        {decks.length > 0 && <NewDeckButton />}
      </div>

      {decks.length === 0 ? (
        <div className="panel narrow empty-state">
          <p>A deck is a set of date ideas you can share. Whoever you send it to picks their favourites into a plan.</p>
          <NewDeckButton label="Make your first deck" />
        </div>
      ) : (
        <ul className="deck-list">
          {decks.map((deck) => (
            <li key={deck.id}>
              <Link className="deck-tile" href={`/decks/${deck.id}`}>
                <strong>{deck.name}</strong>
                <span>
                  {plural(deck.cards, 'idea')} · {plural(deck.plans, 'plan')}
                  {deck.requests > 0 && ` · ${plural(deck.requests, 'edit request')}`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {sharedDecks.length > 0 && (
        <>
          <h3 className="subheading">Shared decks</h3>
          <ul className="deck-list">
            {sharedDecks.map((deck) => (
              <li key={deck.id}>
                <Link className="deck-tile" href={`/decks/${deck.id}`}>
                  <strong>{deck.name}</strong>
                  <span>
                    {deck.ownerName ? `${deck.ownerName}'s deck · ` : ''}
                    {plural(deck.cards, 'idea')} · {plural(deck.plans, 'plan')}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
