'use client'

import { type Transition, useAnimate } from 'motion/react'
import { type CSSProperties, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { saveCardNotes } from '@/lib/actions/plans'
import type { DateCard } from '../types'
import Card from './Card'
import cardStyles from './Card.module.css'
import styles from './CardNotes.module.css'
import type { Frame } from './frames'
import type { Box } from './tilt'

export type Notes = { interest: number | null; notes: string }

type CardNotesProps = {
  card: DateCard
  frame: Frame
  shareId: string
  initial: Notes
  // Where the card sits in the deck, as if it weren't tilted, to flip up
  // from and back down to. A card lifted while leaning straightens as it goes.
  from: Box
  returnTo: () => Box | null
  reduceMotion: boolean
  onChange: (notes: Notes) => void
  onClosed: () => void
}

// Most of the viewport, but no bigger than a comfortable reading size, and
// the same 3:4 shape as a card so the flip lines up.
function targetRect() {
  const width = Math.min(540, window.innerWidth - 32, ((window.innerHeight - 48) * 3) / 4)
  const height = (width * 4) / 3
  return { left: (window.innerWidth - width) / 2, top: (window.innerHeight - height) / 2, width, height }
}

type Rect = ReturnType<typeof targetRect>

// Lays the card over `rect` as if it were still at `to`, turned `rotateY`.
function pose(rect: Rect, to: Box, rotateY: number) {
  return {
    x: to.left + to.width / 2 - (rect.left + rect.width / 2),
    y: to.top + to.height / 2 - (rect.top + rect.height / 2),
    scale: to.width / rect.width,
    rotate: to.rotate ?? 0,
    rotateY,
  }
}

const settled = { x: 0, y: 0, scale: 1, rotate: 0, rotateY: 180 }
const flip: Transition = { duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }
const saveDelay = 700

// A card's rating and notes on its back: the card lifts out of the deck,
// flips over and grows to fill most of the screen, then flips back into
// place when closed (docs/card-notes.md § "Opening a card's notes").
export default function CardNotes({
  card,
  frame,
  shareId,
  initial,
  from,
  returnTo,
  reduceMotion,
  onChange,
  onClosed,
}: CardNotesProps) {
  const [scope, animate] = useAnimate<HTMLDivElement>()
  const dialogReference = useRef<HTMLDialogElement>(null)
  const scrimReference = useRef<HTMLDivElement>(null)
  const [openedAt] = useState(targetRect)
  const [rect, setRect] = useState(openedAt)
  // Starts posed over the deck card so the first frame, before the flip gets
  // going, doesn't flash it full size. Never changes, so React leaves the
  // transform to the animation after that.
  const [startTransform] = useState(() => {
    if (reduceMotion) return 'perspective(1600px) rotateY(180deg)'
    const { x, y, scale, rotate } = pose(openedAt, from, 0)
    return `perspective(1600px) translateX(${x}px) translateY(${y}px) scale(${scale}) rotate(${rotate}deg)`
  })
  const [values, setValues] = useState(initial)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const closing = useRef(false)
  const titleId = useId()

  // Saves one after another, so a slow save can't land after a newer one.
  const queue = useRef(Promise.resolve())
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef(values)

  const save = useCallback(() => {
    if (pending.current) clearTimeout(pending.current)
    pending.current = null
    const toSave = latest.current
    setStatus('saving')
    queue.current = queue.current.then(async () => {
      try {
        const result = await saveCardNotes(shareId, card.id, toSave)
        if (result.ok) {
          setStatus('saved')
          setError(null)
        } else {
          setStatus('error')
          setError(result.error)
        }
      } catch {
        setStatus('error')
        setError("Couldn't save. Check your connection and try again.")
      }
    })
  }, [card.id, shareId])

  function update(next: Notes, { now }: { now: boolean }) {
    latest.current = next
    setValues(next)
    onChange(next)
    if (now) save()
    else {
      if (pending.current) clearTimeout(pending.current)
      pending.current = setTimeout(save, saveDelay)
    }
  }

  // Clicking the chosen star again clears the rating.
  function rate(stars: number) {
    update({ ...values, interest: values.interest === stars ? null : stars }, { now: true })
  }

  async function close() {
    if (closing.current) return
    closing.current = true
    if (pending.current) save()

    const flyer = scope.current
    const to = returnTo()
    if (!reduceMotion && flyer) {
      const scrim = scrimReference.current
      if (scrim) animate(scrim, { opacity: 0 }, flip)
      await (to
        ? animate(flyer, pose(rect, to, 0), flip)
        : animate(flyer, { opacity: 0, scale: 0.9 }, { duration: 0.2 }))
    }
    // The dialog closes when this unmounts, not here, so it goes in the same
    // paint as the deck card shows again. Closed first, Firefox can paint a
    // frame with neither before the parent re-renders.
    onClosed()
  }

  useLayoutEffect(() => {
    const dialog = dialogReference.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])

  useLayoutEffect(() => {
    const flyer = scope.current
    if (reduceMotion) {
      animate(flyer, settled, { duration: 0 })
      return
    }
    const start = pose(openedAt, from, 0)
    const controls = animate(
      flyer,
      {
        x: [start.x, 0],
        y: [start.y, 0],
        scale: [start.scale, 1],
        rotate: [start.rotate, 0],
        rotateY: [0, 180],
        transformPerspective: [1600, 1600],
      },
      flip,
    )
    const scrim = scrimReference.current
    if (scrim) animate(scrim, { opacity: [0, 1] }, flip)
    return () => controls.stop()
  }, [animate, from, openedAt, reduceMotion, scope])

  // Follows the window's width (a rotated phone), but not its height, which
  // shrinks when an on-screen keyboard opens.
  useEffect(() => {
    let width = window.innerWidth
    function resize() {
      if (window.innerWidth === width) return
      width = window.innerWidth
      setRect(targetRect())
    }
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  // Anything still waiting to save goes when the page is left.
  useEffect(() => {
    function flush() {
      if (pending.current) save()
    }
    window.addEventListener('pagehide', flush)
    return () => window.removeEventListener('pagehide', flush)
  }, [save])

  const frontScale = { '--front-scale': rect.width / from.width } as CSSProperties

  return createPortal(
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape closes it too, through onCancel
    <dialog
      className={styles.dialog}
      ref={dialogReference}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
      // The dialog fills the screen, so a click on it rather than inside the
      // card is a click beside the card.
      onClick={(event) => {
        if (event.target === event.currentTarget) close()
      }}
    >
      <div className={styles.scrim} ref={scrimReference} aria-hidden="true" />
      <div className={styles.flipper} ref={scope} style={{ ...rect, transform: startTransform }}>
        {/* Laid out at the deck card's size and scaled up, so it looks just
            like the card it lifted out of. */}
        <div
          className={`${cardStyles.card} ${styles.face} ${styles.front}`}
          style={{ width: from.width, height: from.height, ...frontScale }}
          aria-hidden="true"
        >
          <Card card={card} frame={frame} scrawl={values} />
        </div>

        <div className={`${styles.face} ${styles.back}`}>
          <h2 className={styles.title} id={titleId}>
            {card.title}
          </h2>
          {card.addedAt && (
            // Only drawn in the browser, so the visitor's own locale and time
            // zone can't cause a hydration mismatch.
            <p className={styles.added}>
              Added{' '}
              <time dateTime={card.addedAt}>
                {new Date(card.addedAt).toLocaleDateString(undefined, { dateStyle: 'long' })}
              </time>
            </p>
          )}

          <fieldset className={styles.rating}>
            <legend>How keen are you?</legend>
            <div className={styles.stars}>
              {[1, 2, 3, 4, 5].map((stars) => (
                <label className={styles.star} key={stars} data-filled={(values.interest ?? 0) >= stars}>
                  <input
                    className="visually-hidden"
                    type="radio"
                    name={`interest-${card.id}`}
                    value={stars}
                    checked={values.interest === stars}
                    onChange={() => {}}
                    onClick={() => rate(stars)}
                  />
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" />
                  </svg>
                  <span className="visually-hidden">
                    {stars} {stars === 1 ? 'star' : 'stars'}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className={styles.notesField}>
            <span className="visually-hidden">Notes</span>
            <textarea
              value={values.notes}
              maxLength={2000}
              placeholder="What do you think of this idea?"
              onChange={(event) => update({ ...values, notes: event.target.value }, { now: false })}
              onBlur={() => {
                if (pending.current) save()
              }}
            />
          </label>

          <div className={styles.footer}>
            <span className={styles.status} role="status">
              {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : ''}
            </span>
            <button className="done-button" type="button" onClick={close}>
              Done
            </button>
          </div>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    </dialog>,
    document.body,
  )
}
