import type { Metadata } from 'next'
import Link from 'next/link'
import NewDeckButton from '@/components/decks/NewDeckButton'
import { getDb } from '@/db'
import { requireUser } from '@/lib/auth'
import { listDecks } from '@/lib/decks'

export const metadata: Metadata = { title: 'Your decks' }

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

export default async function Decks() {
  const user = await requireUser()
  const decks = await listDecks(getDb(), user.id)

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
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
