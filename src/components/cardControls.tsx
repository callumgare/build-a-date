'use client'

import { animate } from 'motion/react'
import { type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, useEffect, useState } from 'react'
import cardStyles from './Card.module.css'
import { hoverScale, leanOf, randomTilt, untiltedBox } from './tilt'

// What's on a card's options band and in its corners, shared by the builder
// (/d/…) and the plan page (/p/…).

export type Side = 'primary' | 'notes'
// A card on the plan page only has Notes (docs/card-notes.md § "Card actions").
export type SideActions = { primary?: () => void; notes: () => void }

// Where the card would be sitting straight, and how far it leans right now
// (it may be hovered, or part way back from it), so the animations that
// lift it out of place can size it right and turn it level themselves.
export function cardBox(element: Element) {
  return untiltedBox(element, leanOf(getComputedStyle(element).transform))
}

// A click on either half of a card does what's written on that side, or
// anywhere on it when there's only Notes (docs/card-notes.md § "Card
// actions"). Without hover the first tap only shows the options, so it can't
// add or discard the card by accident.
export function useCardTaps() {
  // The card showing its buttons after a tap, for screens without hover.
  const [revealedId, setRevealedId] = useState<string | null>(null)

  // Tapping anywhere else hides the buttons a tap revealed.
  useEffect(() => {
    if (!revealedId) return
    function hide(event: PointerEvent) {
      if (!(event.target instanceof Element) || !event.target.closest("[data-revealed='true']")) setRevealedId(null)
    }
    document.addEventListener('pointerdown', hide)
    return () => document.removeEventListener('pointerdown', hide)
  }, [revealedId])

  function clickCard(id: string, event: ReactMouseEvent<HTMLElement>, actions: SideActions) {
    if (event.target instanceof Element && event.target.closest('button, a')) return
    if (!window.matchMedia('(hover: hover)').matches && revealedId !== id) {
      setRevealedId(id)
      return
    }
    if (actions.primary && sideOf(event) === 'primary') actions.primary()
    else actions.notes()
  }

  return { revealedId, setRevealedId, clickCard }
}

// Cards sit straight, and lift a little bigger and tip to one side while the
// mouse is over them, a different way each time (docs/card-layout.md
// § "Tilting on hover"). Plain pointer events rather than Motion's
// onHoverStart, which runs a frame late, once the event no longer has a
// currentTarget. Touch is left out, so a tap doesn't leave a card leaning.
export function tiltCard(event: ReactPointerEvent<HTMLElement>) {
  if (event.pointerType === 'touch') return
  animate(event.currentTarget, { rotate: randomTilt(), scale: hoverScale }, hoverSpring)
}

export function leaveCard(event: ReactPointerEvent<HTMLElement>) {
  delete event.currentTarget.dataset.side
  animate(event.currentTarget, { rotate: 0, scale: 1 }, hoverSpring)
}

const hoverSpring = { type: 'spring', stiffness: 400, damping: 22 } as const

// Add to plan or Discard is on the left half of a card, Notes on the right.
function sideOf(event: { clientX: number; currentTarget: Element }): Side {
  const rect = event.currentTarget.getBoundingClientRect()
  return event.clientX < rect.left + rect.width / 2 ? 'primary' : 'notes'
}

// Marks which option a click would pick, so its label can go bold. Set on the
// element directly, as it changes with every move of the mouse. Nothing is
// marked over a link, the edit button or the grip, since a click there does
// that instead.
export function showHoveredSide(event: ReactPointerEvent<HTMLElement>, { onlyNotes = false } = {}) {
  if (event.pointerType === 'touch') return
  const overLink =
    event.target instanceof Element && event.target.closest(`a, .${cardStyles.edit}, .${cardStyles.grip}`)
  if (overLink) delete event.currentTarget.dataset.side
  else event.currentTarget.dataset.side = onlyNotes ? 'notes' : sideOf(event)
}

type CardActionsProps = {
  title: string
  // Left out on the plan page, which only has Notes.
  primary?: 'Add to plan' | 'Discard'
  actions: SideActions
}

// The options in a card's top band (docs/card-notes.md § "Card actions").
// Clicking a card does the same as the label on that side; the labels are
// buttons too, for the keyboard. Labels start with the words on the button,
// for voice control.
export function CardActions({ title, primary, actions }: CardActionsProps) {
  return (
    <>
      {primary && (
        <button
          className={`${cardStyles.action} ${cardStyles.primaryAction}`}
          type="button"
          aria-label={`${primary}: ${title}`}
          onClick={actions.primary}
        >
          {primary}
        </button>
      )}
      <button
        className={`${cardStyles.action} ${cardStyles.notesAction}`}
        type="button"
        aria-label={`Notes on ${title}`}
        onClick={actions.notes}
      >
        Notes
      </button>
    </>
  )
}

// Opens the card form from the card's bottom left corner, for people who can
// edit the deck (docs/card-notes.md § "Editing a card").
export function EditButton({ title, onClick }: { title: string; onClick: () => void }) {
  return (
    <button className={cardStyles.edit} type="button" aria-label={`Edit ${title}`} onClick={onClick}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 20h4L19 9l-4-4L4 16v4Z" />
        <path d="m13.5 6.5 4 4" />
      </svg>
    </button>
  )
}
