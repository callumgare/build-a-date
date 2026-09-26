'use client'

import { useReducedMotion } from 'motion/react'
import { useCallback, useState } from 'react'
import type { DateCard } from '@/types'
import Card from './Card'
import cardStyles from './Card.module.css'
import CardNotes, { type Notes } from './CardNotes'
import {
  CardActions,
  cardBox,
  EditButton,
  leaveCard,
  type SideActions,
  showHoveredSide,
  tiltCard,
  useCardTaps,
} from './cardControls'
import { useCardEditor } from './decks/useCardEditor'
import { frameFor } from './frames'
import type { Box } from './tilt'

type PlanViewProps = {
  shareId: string
  // The cards on the plan's first row, then its groups, each on a row of
  // its own (docs/plans.md § "Groups").
  cards: DateCard[]
  groups?: { id: string; title: string; notes: string; cards: DateCard[] }[]
  // Only for owners and editors, who can change the cards from here too.
  deckId?: string
  // Every tag in the deck, for the card form to suggest.
  deckTags?: string[]
}

// A saved plan's cards (docs/plans.md § "The plan page"). They show their
// rating and notes, and open them like on the shared deck, but can't be
// discarded here: that's done by editing the plan.
export default function PlanView({ shareId, cards, groups = [], deckId, deckTags = [] }: PlanViewProps) {
  const { revealedId, setRevealedId, clickCard } = useCardTaps()
  const [notesOpen, setNotesOpen] = useState<{ id: string; from: Box } | null>(null)
  const allCards = [...cards, ...groups.flatMap((group) => group.cards)]
  const [notesById, setNotesById] = useState(
    () =>
      new Map<string, Notes>(
        allCards.map((card) => [card.id, { interest: card.interest ?? null, notes: card.notes ?? '' }]),
      ),
  )
  const reduceMotion = useReducedMotion()
  const cardEditor = useCardEditor(deckId, deckTags)

  function cardElement(id: string) {
    return document.querySelector(`[data-card-id="${CSS.escape(id)}"]`)
  }

  function openNotes(id: string) {
    const element = cardElement(id)
    if (!element) return
    setRevealedId(null)
    setNotesOpen({ id, from: cardBox(element) })
  }

  const changeNotes = useCallback((id: string, notes: Notes) => {
    setNotesById((current) => new Map(current).set(id, notes))
  }, [])

  const notesCard = notesOpen && allCards.find((card) => card.id === notesOpen.id)

  function renderCard(card: DateCard) {
    const actions: SideActions = { notes: () => openNotes(card.id) }

    return (
      // biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: the Notes button inside is the keyboard's way in
      <div
        className={`${cardStyles.card} ${notesOpen?.id === card.id ? cardStyles.inFlight : ''}`}
        key={card.id}
        data-card-id={card.id}
        data-revealed={revealedId === card.id}
        onPointerEnter={tiltCard}
        onPointerMove={(event) => showHoveredSide(event, { onlyNotes: true })}
        onPointerLeave={leaveCard}
        onClick={(event) => clickCard(card.id, event, actions)}
      >
        <Card
          card={card}
          frame={frameFor(card.id)}
          actions={<CardActions title={card.title} actions={actions} />}
          scrawl={notesById.get(card.id)}
        />
        {deckId && (
          <EditButton
            title={card.title}
            onClick={() => {
              setRevealedId(null)
              cardEditor.editCard(card)
            }}
          />
        )}
      </div>
    )
  }

  return (
    <>
      {cards.length > 0 && <div className="plan-track">{cards.map(renderCard)}</div>}

      {groups.map((group) => (
        <section className="plan-group" key={group.id} aria-label={group.title || 'A group'}>
          {(group.title || group.notes) && (
            <div className="plan-group-info">
              {group.title && <h2 className="plan-group-heading">{group.title}</h2>}
              {group.notes && <p className="plan-group-text">{group.notes}</p>}
            </div>
          )}
          {group.cards.length > 0 && <div className="plan-track plan-group-track">{group.cards.map(renderCard)}</div>}
        </section>
      ))}

      {notesOpen && notesCard && (
        <CardNotes
          key={notesOpen.id}
          card={notesCard}
          frame={frameFor(notesCard.id)}
          shareId={shareId}
          initial={notesById.get(notesCard.id) ?? { interest: null, notes: '' }}
          from={notesOpen.from}
          returnTo={() => {
            const element = cardElement(notesCard.id)
            return element ? cardBox(element) : null
          }}
          reduceMotion={Boolean(reduceMotion)}
          onChange={(notes) => changeNotes(notesCard.id, notes)}
          onClosed={() => setNotesOpen(null)}
        />
      )}

      {cardEditor.dialogs}
    </>
  )
}
