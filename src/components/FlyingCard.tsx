'use client'

import { type Transition, useAnimate } from 'motion/react'
import { type RefObject, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import type { DateCard } from '../types'
import Card from './Card'
import styles from './Card.module.css'
import type { Frame } from './frames'

type FlyingCardProps = {
  card: DateCard
  frame: Frame
  from: DOMRect
  track: RefObject<HTMLElement | null>
  transition: Transition
  onDone: () => void
}

// The plan track scrolls horizontally, which also clips it vertically, so a
// card animating up from the deck would be cut off at the track's edge. This
// flies a stand-in above the page instead, while the real card waits hidden
// in its slot.
export default function FlyingCard({ card, frame, from, track, transition, onDone }: FlyingCardProps) {
  const [scope, animate] = useAnimate<HTMLDivElement>()

  useLayoutEffect(() => {
    const trackElement = track.current
    const slot = trackElement?.querySelector<HTMLElement>(`[data-card-id="${CSS.escape(card.id)}"]`)
    if (!trackElement || !slot) {
      onDone()
      return
    }

    // Offsets rather than getBoundingClientRect, as the slot may already have
    // a layout-animation transform applied.
    const overflow = slot.offsetLeft + slot.offsetWidth - trackElement.clientWidth
    if (overflow > trackElement.scrollLeft) trackElement.scrollTo({ left: overflow + 5 })

    const trackRect = trackElement.getBoundingClientRect()
    const left = trackRect.left + trackElement.clientLeft + slot.offsetLeft - trackElement.scrollLeft
    const top = trackRect.top + trackElement.clientTop + slot.offsetTop - trackElement.scrollTop

    // Lay the stand-in out at the slot's exact size so it lands matching the
    // real card, then start it scaled down (or up) over the deck card.
    const flyer = scope.current
    Object.assign(flyer.style, {
      top: `${top}px`,
      left: `${left}px`,
      width: `${slot.offsetWidth}px`,
      height: `${slot.offsetHeight}px`,
    })

    let cancelled = false
    const controls = animate(
      flyer,
      {
        x: [from.left - left, 0],
        y: [from.top - top, 0],
        scaleX: [from.width / slot.offsetWidth, 1],
        scaleY: [from.height / slot.offsetHeight, 1],
      },
      transition,
    )
    controls.then(() => {
      if (!cancelled) onDone()
    })

    return () => {
      cancelled = true
      controls.stop()
    }
  }, [animate, card.id, from, onDone, scope, track, transition])

  return createPortal(
    <div className={`${styles.card} ${styles.flying}`} ref={scope} aria-hidden="true">
      <Card card={card} frame={frame} />
    </div>,
    document.body,
  )
}
