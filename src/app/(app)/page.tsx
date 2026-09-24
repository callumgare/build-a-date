import Link from 'next/link'
import { redirect } from 'next/navigation'
import Card from '@/components/Card'
import cardStyles from '@/components/Card.module.css'
import { frameFor } from '@/components/frames'
import { starterCards } from '@/data/starter-cards'
import { getSession } from '@/lib/auth'

const samples = [0, 4, 6, 10].map((index) => ({
  ...starterCards[index],
  id: starterCards[index].title,
  description: starterCards[index].description ?? '',
  date: undefined,
}))

export default async function Home() {
  if (await getSession()) redirect('/decks')

  return (
    <>
      <header className="hero">
        <h1>Build-a-Date</h1>
      </header>
      <p className="lede">
        Make a deck of date ideas and share it. Whoever you send it to picks the cards they like and sends a plan back.
      </p>
      <div className="hero-actions">
        <Link className="done-button" href="/sign-up">
          Make a deck
        </Link>
        <Link className="text-action" href="/sign-in">
          Sign in
        </Link>
      </div>

      <div className="sample-cards" aria-hidden="true">
        {samples.map((card) => (
          <div className={cardStyles.card} key={card.id}>
            <Card card={card} frame={frameFor(card.id)} />
          </div>
        ))}
      </div>
    </>
  )
}
