'use client'

import { type FormEvent, type KeyboardEvent, useMemo, useState, useTransition } from 'react'
import { deleteDeck, leaveDeck, renameDeck } from '@/lib/actions/decks'
import type { DeckRole } from '@/lib/decks'
import type { DateCard } from '@/types'
import Card from '../Card'
import cardStyles from '../Card.module.css'
import { frameFor } from '../frames'
import AddCardControls from './AddCardControls'
import { AccessRequests, type DeckPerson, Editors } from './DeckAccess'
import { useCardEditor } from './useCardEditor'

type DeckEditorProps = {
  deck: { id: string; name: string; shareId: string }
  // Editors can change the cards; only the owner renames, deletes or decides
  // who else can edit.
  role: DeckRole
  access: DeckPerson[]
  shareUrl: string
  cards: DateCard[]
  plans: { id: string; createdAt: Date; cards: number }[]
}

// Cards are divs rather than buttons so their descriptions can hold links,
// so Enter and Space have to trigger them by hand.
function clickOnActivationKey(event: KeyboardEvent<HTMLElement>) {
  if (event.target !== event.currentTarget) return
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  event.currentTarget.click()
}

export default function DeckEditor({ deck, role, access, shareUrl, cards, plans }: DeckEditorProps) {
  const [renaming, setRenaming] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const deckTags = useMemo(() => [...new Set(cards.flatMap((card) => card.tags))].sort(), [cards])
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
    <section className="app-section">
      <div className="section-heading">
        {renaming ? (
          <form className="rename-form" onSubmit={rename}>
            <input
              name="name"
              defaultValue={deck.name}
              required
              maxLength={80}
              aria-label="Deck name"
              // biome-ignore lint/a11y/noAutofocus: the field the Rename button just revealed
              autoFocus
            />
            <button className="done-button" type="submit" disabled={pending}>
              Save
            </button>
            <button className="text-action" type="button" onClick={() => setRenaming(false)}>
              Cancel
            </button>
          </form>
        ) : (
          <>
            <h2>{deck.name}</h2>
            {role === 'owner' ? (
              <div className="section-actions">
                <button className="text-action" type="button" onClick={() => setRenaming(true)}>
                  Rename
                </button>
                <button className="text-action" type="button" onClick={remove} disabled={pending}>
                  Delete deck
                </button>
              </div>
            ) : (
              <form
                className="section-actions"
                action={leaveDeck.bind(null, deck.id)}
                onSubmit={(event) => {
                  if (!window.confirm(`Stop editing "${deck.name}"? You'd need to ask again to get back in.`)) {
                    event.preventDefault()
                  }
                }}
              >
                <button className="text-action" type="submit">
                  Leave deck
                </button>
              </form>
            )}
          </>
        )}
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="panel share-panel">
        <p>
          <strong>Share this link</strong> with whoever you&apos;re planning a date with. They don&apos;t need an
          account to build a plan.
        </p>
        <div className="share-row">
          <input readOnly value={shareUrl} aria-label="Share link" onFocus={(event) => event.target.select()} />
          <button className="done-button" type="button" onClick={copyLink}>
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <a className="text-action" href={`/d/${deck.shareId}`} target="_blank" rel="noreferrer">
            Open
          </a>
        </div>
      </div>

      {role === 'owner' && <AccessRequests deckId={deck.id} people={access} />}

      <h3 className="subheading">
        Ideas <small>({cards.length})</small>
      </h3>
      <div className="card-grid editor-grid">
        <AddCardControls onAdd={cardEditor.addCard} onQuickAdd={cardEditor.quickAdd} />
        {cards.map((card) => (
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
      </div>

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

      {role === 'owner' && <Editors deckId={deck.id} people={access} />}

      {cardEditor.dialogs}
    </section>
  )
}
