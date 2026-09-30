'use client'

import { type FormEvent, type KeyboardEvent, useMemo, useState, useTransition } from 'react'
import { deleteDeck, leaveDeck, renameDeck } from '@/lib/actions/decks'
import type { DeckRole } from '@/lib/decks'
import type { DateCard } from '@/types'
import Card from '../Card'
import cardStyles from '../Card.module.css'
import CardGrid from '../CardGrid'
import { frameFor } from '../frames'
import SharePreviewRefresher, { type PreviewProps } from '../SharePreviewRefresher'
import Button from '../ui/Button'
import { FormError, Input } from '../ui/Form'
import Heading, { Subheading } from '../ui/Heading'
import { PageSection, SectionActions, SectionHeading } from '../ui/PageSection'
import Panel from '../ui/Panel'
import AddCardControls from './AddCardControls'
import { AccessRequests, type DeckPerson, Editors } from './DeckAccess'
import styles from './DeckEditor.module.css'
import PlanList, { type PlanSummary } from './PlanList'
import { useCardEditor } from './useCardEditor'

type DeckEditorProps = {
  deck: { id: string; name: string; shareId: string }
  // Editors can change the cards; only the owner renames, deletes or decides
  // who else can edit.
  role: DeckRole
  access: DeckPerson[]
  shareUrl: string
  cards: DateCard[]
  plans: PlanSummary[]
  // Keeps the deck's link preview up to date (docs/share-previews.md § "When it's drawn").
  preview?: PreviewProps
}

// Cards are divs rather than buttons so their descriptions can hold links,
// so Enter and Space have to trigger them by hand.
function clickOnActivationKey(event: KeyboardEvent<HTMLElement>) {
  if (event.target !== event.currentTarget) return
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  event.currentTarget.click()
}

export default function DeckEditor({ deck, role, access, shareUrl, cards, plans, preview }: DeckEditorProps) {
  const [renaming, setRenaming] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const deckTags = useMemo(() => [...new Set(cards.flatMap((card) => card.tags))].sort(), [cards])
  // Newest first (docs/deck-sorting.md § "On the deck's own page").
  const newestFirst = useMemo(() => [...cards].reverse(), [cards])
  const cardEditor = useCardEditor(deck.id, deckTags)

  function rename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = String(new FormData(event.currentTarget).get('name'))
    startTransition(async () => {
      const result = await renameDeck(deck.id, name)
      if (result.ok) setRenaming(false)
      else setError(result.error)
    })
  }

  function remove() {
    if (!window.confirm(`Delete "${deck.name}" and every plan made from it? This can't be undone.`)) return
    startTransition(async () => {
      const result = await deleteDeck(deck.id)
      if (!result.ok) setError(result.error)
    })
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <PageSection>
      {preview && <SharePreviewRefresher {...preview} />}
      <SectionHeading>
        {renaming ? (
          <form className={styles.renameForm} onSubmit={rename}>
            <Input
              name="name"
              defaultValue={deck.name}
              required
              maxLength={80}
              aria-label="Deck name"
              // Focused: the field the Rename button just revealed.
              autoFocus
            />
            <Button type="submit" disabled={pending}>
              Save
            </Button>
            <Button variant="text" onClick={() => setRenaming(false)}>
              Cancel
            </Button>
          </form>
        ) : (
          <>
            <Heading size="section">{deck.name}</Heading>
            {role === 'owner' ? (
              <SectionActions>
                <Button variant="text" onClick={() => setRenaming(true)}>
                  Rename
                </Button>
                <Button variant="text" onClick={remove} disabled={pending}>
                  Delete deck
                </Button>
              </SectionActions>
            ) : (
              <form
                action={leaveDeck.bind(null, deck.id)}
                onSubmit={(event) => {
                  if (!window.confirm(`Stop editing "${deck.name}"? You'd need to ask again to get back in.`)) {
                    event.preventDefault()
                  }
                }}
              >
                <SectionActions>
                  <Button variant="text" type="submit">
                    Leave deck
                  </Button>
                </SectionActions>
              </form>
            )}
          </>
        )}
      </SectionHeading>
      <FormError>{error}</FormError>

      <Panel as="div" className={styles.sharePanel}>
        <p>
          <strong>Share this link</strong> with whoever you&apos;re planning a date with. They don&apos;t need an
          account to build a plan.
        </p>
        <div className={styles.shareRow}>
          <Input readOnly value={shareUrl} aria-label="Share link" onFocus={(event) => event.target.select()} />
          <Button onClick={copyLink}>{copied ? 'Copied!' : 'Copy'}</Button>
          <Button variant="text" href={`/d/${deck.shareId}`} native target="_blank" rel="noreferrer">
            Open
          </Button>
        </div>
      </Panel>

      {role === 'owner' && <AccessRequests deckId={deck.id} people={access} />}

      <Subheading count={cards.length}>Ideas</Subheading>
      <CardGrid>
        <AddCardControls onAdd={cardEditor.addCard} onQuickAdd={cardEditor.quickAdd} />
        {newestFirst.map((card) => (
          // biome-ignore lint/a11y/useSemanticElements: a div so descriptions can hold links (see clickOnActivationKey)
          <div
            className={cardStyles.card}
            key={card.id}
            role="button"
            tabIndex={0}
            onClick={() => cardEditor.editCard(card)}
            onKeyDown={clickOnActivationKey}
            aria-label={`Edit ${card.title}`}
          >
            <Card card={card} frame={frameFor(card.id)} />
          </div>
        ))}
      </CardGrid>

      <PlanList plans={plans} />

      {role === 'owner' && <Editors deckId={deck.id} people={access} />}

      {cardEditor.dialogs}
    </PageSection>
  )
}
