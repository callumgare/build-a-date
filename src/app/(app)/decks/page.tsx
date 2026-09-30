import type { Metadata } from 'next'
import DeckList from '@/components/decks/DeckList'
import NewDeckButton from '@/components/decks/NewDeckButton'
import Heading, { Subheading } from '@/components/ui/Heading'
import { PageSection, SectionHeading } from '@/components/ui/PageSection'
import Panel from '@/components/ui/Panel'
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
    <PageSection>
      <SectionHeading>
        <Heading size="section">Your decks</Heading>
        {decks.length > 0 && <NewDeckButton />}
      </SectionHeading>

      {decks.length === 0 ? (
        <Panel narrow align="center" as="div">
          <p>A deck is a set of date ideas you can share. Whoever you send it to picks their favourites into a plan.</p>
          <NewDeckButton label="Make your first deck" />
        </Panel>
      ) : (
        <DeckList
          decks={decks.map((deck) => ({
            id: deck.id,
            name: deck.name,
            details: [
              plural(deck.cards, 'idea'),
              plural(deck.plans, 'plan'),
              ...(deck.requests > 0 ? [plural(deck.requests, 'edit request')] : []),
            ].join(' · '),
          }))}
        />
      )}

      {sharedDecks.length > 0 && (
        <>
          <Subheading>Shared decks</Subheading>
          <DeckList
            decks={sharedDecks.map((deck) => ({
              id: deck.id,
              name: deck.name,
              details: `${deck.ownerName ? `${deck.ownerName}'s deck · ` : ''}${plural(deck.cards, 'idea')} · ${plural(deck.plans, 'plan')}`,
            }))}
          />
        </>
      )}
    </PageSection>
  )
}
