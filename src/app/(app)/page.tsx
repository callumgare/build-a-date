import { redirect } from 'next/navigation'
import Card from '@/components/Card'
import cardStyles from '@/components/Card.module.css'
import { frameFor } from '@/components/frames'
import Button from '@/components/ui/Button'
import Hero, { Lede } from '@/components/ui/Hero'
import Muted from '@/components/ui/Muted'
import { starterCards } from '@/data/starter-cards'
import { getSession } from '@/lib/auth'
import styles from './page.module.css'

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
      <Hero title="Build-a-Date" />
      <Lede>
        Make a deck of date ideas and share it (it's free!). Whoever you send it to picks the cards they like and sends
        a plan back.
      </Lede>
      <div className={styles.actions}>
        <Button href="/sample">Try a sample deck</Button>
        <Muted>- or -</Muted>
        <Button href="/sign-up">Make your own deck</Button>
        <Button variant="text" href="/sign-in">
          Sign in
        </Button>
      </div>

      <div className={styles.samples} aria-hidden="true">
        {samples.map((card) => (
          <div className={cardStyles.card} key={card.id}>
            <Card card={card} frame={frameFor(card.id)} />
          </div>
        ))}
      </div>
    </>
  )
}
