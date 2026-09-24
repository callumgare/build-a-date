// Turns src/data/cards.json (the deck from before accounts existed) into SQL
// that adds it as a deck owned by an existing account:
//
//   node scripts/import-cards.ts you@example.com "Melbourne dates" > import.sql
//   npx wrangler d1 execute build-a-date --remote --file import.sql
//
// Cards keep their old ids, so each keeps the frame it had before. That also
// means this can only be run once per database.
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'

type OldCard = { id: string; title: string; description: string; tags: string[]; date?: string }

const [email, name = 'Build-a-Date'] = process.argv.slice(2)
if (!email) {
  console.error('Usage: node scripts/import-cards.ts <owner email> [deck name] > import.sql')
  process.exit(1)
}

const cards: OldCard[] = JSON.parse(readFileSync(new URL('../src/data/cards.json', import.meta.url), 'utf8'))
const alphabet = '23456789abcdefghjkmnpqrstuvwxyz'
const code = (length: number) => [...randomBytes(length)].map((byte) => alphabet[byte % alphabet.length]).join('')
const text = (value: string | null | undefined) => (value == null ? 'NULL' : `'${value.replaceAll("'", "''")}'`)

const deckId = code(21)
const lines = [
  // Inserts nothing if there's no account with that email; the card inserts
  // then fail on their foreign key, so nothing half-imports.
  `INSERT INTO deck (id, owner_id, name, share_id) SELECT ${text(deckId)}, id, ${text(name)}, ${text(code(10))} FROM user WHERE email = ${text(email)};`,
  ...cards.map(
    (card, position) =>
      `INSERT INTO card (id, deck_id, title, description, tags, date, position) VALUES (${[
        text(card.id),
        text(deckId),
        text(card.title),
        text(card.description),
        text(JSON.stringify(card.tags)),
        text(card.date),
        position,
      ].join(', ')});`,
  ),
]
console.log(lines.join('\n'))
console.error(`${cards.length} cards for ${email}. Deck id: ${deckId}`)
