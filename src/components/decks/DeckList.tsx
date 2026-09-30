import Link from 'next/link'
import styles from './DeckList.module.css'

export type DeckTileProps = { id: string; name: string; details: string }

// Decks as tiles that wrap, each opening the deck's page.
export default function DeckList({ decks }: { decks: DeckTileProps[] }) {
  return (
    <ul className={styles.list}>
      {decks.map((deck) => (
        <li key={deck.id}>
          <Link className={styles.tile} href={`/decks/${deck.id}`}>
            <strong>{deck.name}</strong>
            <span>{deck.details}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
