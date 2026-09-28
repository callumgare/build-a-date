'use client'

import { type Transition, useAnimate } from 'motion/react'
import { type RefObject, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import type { DateCard } from '../types'
import Card from './Card'
import styles from './Card.module.css'
import type { Notes } from './CardNotes'
import type { Frame } from './frames'
import { shrinkOf } from './shrink'
import type { Box } from './tilt'

type FlyingCardProps = {
  card: DateCard
  frame: Frame
  scrawl?: Notes
  // Where the deck card sits, as if it weren't tilted, and how far it leans.
  from: Box
  // The column the card is flying into, and the attribute its slot there is
  // marked with, holding the card's id. The plan's column scrolls to show
  // the slot.
  into: RefObject<HTMLElement | null>
  slot: 'data-card-id' | 'data-deck-card-id'
  transition: Transition
  onDone: (id: string) => void
}

// A card picked from the deck, or discarded from the plan, flying across to
// its new place (docs/card-layout.md § "Flying cards"). The plan scrolls,
// which clips it, and either column may be shrunk, so this flies a stand-in
// above the page instead, while the real card waits hidden in its slot.
export default function FlyingCard({ card, frame, scrawl, from, into, slot, transition, onDone }: FlyingCardProps) {
  const [scope, animate] = useAnimate<HTMLDivElement>()

  useLayoutEffect(() => {
    const column = into.current
    const target = column?.querySelector<HTMLElement>(`[${slot}="${CSS.escape(card.id)}"]`)
    const parent = target?.offsetParent
    if (!column || !target || !(parent instanceof HTMLElement)) {
      onDone(card.id)
      return
    }

    // Scrolls the column to show the slot, if it's below what's showing and
    // the column scrolls.
    const columnBottom = Math.min(column.getBoundingClientRect().bottom, window.innerHeight)
    const before = slotBox(target, parent)
    const overflow = before.top + before.height - columnBottom
    if (overflow > 0) column.scrollTop += overflow + 14

    const { left, top, width, height } = slotBox(target, parent)
    // In a shrunk column the slot is drawn a fifth of its size. The stand-in
    // is laid out at the card's own size, so its text wraps and fits as the
    // card's does, and scaled down to land on it, rather than laid out that
    // small, where the text can't shrink to match.
    const shrunk = shrinkOf(target)
    const layoutWidth = width / shrunk
    const layoutHeight = height / shrunk
    const centreX = left + width / 2
    const centreY = top + height / 2

    // Start it scaled to the card it leaves and leaning as that card did,
    // straightening as it goes. It scales and turns about its centre, as the
    // cards themselves do.
    const flyer = scope.current
    Object.assign(flyer.style, {
      top: `${centreY - layoutHeight / 2}px`,
      left: `${centreX - layoutWidth / 2}px`,
      width: `${layoutWidth}px`,
      height: `${layoutHeight}px`,
    })

    let cancelled = false
    const controls = animate(
      flyer,
      {
        x: [from.left + from.width / 2 - centreX, 0],
        y: [from.top + from.height / 2 - centreY, 0],
        scaleX: [from.width / layoutWidth, shrunk],
        scaleY: [from.height / layoutHeight, shrunk],
        rotate: [from.rotate ?? 0, 0],
      },
      transition,
    )
    controls.then(() => {
      if (!cancelled) onDone(card.id)
    })

    return () => {
      cancelled = true
      controls.stop()
    }
  }, [animate, card.id, from, onDone, scope, into, slot, transition])

  return createPortal(
    <div className={`${styles.card} ${styles.flying}`} ref={scope} aria-hidden="true">
      <Card card={card} frame={frame} scrawl={scrawl} />
    </div>,
    document.body,
  )
}

// Where the slot is on screen. Offsets rather than getBoundingClientRect, as
// the slot may already have a layout-animation transform applied. Offsets
// aren't shrunk with a column that isn't in use on a narrow screen
// (docs/card-layout.md § "Narrow screens"), so they're scaled to match the
// slot's offset parent (its row, or the deck's grid) as it's drawn.
function slotBox(slot: HTMLElement, parent: HTMLElement) {
  const parentRect = parent.getBoundingClientRect()
  const scale = parent.offsetWidth ? parentRect.width / parent.offsetWidth : 1
  return {
    left: parentRect.left + (parent.clientLeft + slot.offsetLeft) * scale,
    top: parentRect.top + (parent.clientTop + slot.offsetTop) * scale,
    width: slot.offsetWidth * scale,
    height: slot.offsetHeight * scale,
  }
}
