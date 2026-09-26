'use client'

import { animate, type HTMLMotionProps, type MotionValue, motion, useMotionValue } from 'motion/react'
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import cardStyles from './Card.module.css'
import { cardBox } from './cardControls'
import { edgeScrollSpeed } from './edgeScroll'
import { dragLean } from './tilt'

// Where a dragged card would go: a row of the plan (its first row, or a
// group) and its place among the other cards there.
export type DropPlace = { row: string; index: number }

// One step from the keyboard: along its row, or onto the row above or below.
export type KeyboardMove = { along?: -1 | 1; across?: -1 | 1 }

type PlanCardProps = Omit<HTMLMotionProps<'div'>, 'onPointerDown' | 'children'> & {
  children: ReactNode
  title: string
  // Whether this is the card being dragged, which stays in its place, faded,
  // while a stand-in follows the pointer.
  lifted: boolean
  onPress: (event: ReactPointerEvent<HTMLElement>) => void
  onMove: (move: KeyboardMove) => void
}

// A card in the plan, which a mouse can drag from anywhere on it, onto any
// row. A touch only drags from the grip, so a swipe across the card still
// scrolls the plan (docs/card-layout.md § "Reordering the plan").
export function PlanCard({ title, lifted, onPress, onMove, className, children, ...props }: PlanCardProps) {
  function moveFromKeyboard(event: ReactKeyboardEvent) {
    const move: KeyboardMove | null =
      event.key === 'ArrowLeft'
        ? { along: -1 }
        : event.key === 'ArrowRight'
          ? { along: 1 }
          : event.key === 'ArrowUp'
            ? { across: -1 }
            : event.key === 'ArrowDown'
              ? { across: 1 }
              : null
    if (!move) return
    event.preventDefault()
    onMove(move)
  }

  return (
    <motion.div
      layout
      onPointerDown={onPress}
      className={`${className} ${cardStyles.reorderable} ${lifted ? cardStyles.lifted : ''}`}
      {...props}
    >
      {children}
      <button
        className={cardStyles.grip}
        type="button"
        aria-label={`Move ${title}`}
        aria-description="Drag, or use the arrow keys, to move it along the plan or to another group"
        onKeyDown={moveFromKeyboard}
      >
        <svg viewBox="0 0 24 12" aria-hidden="true">
          {[4, 10, 16].flatMap((x) => [2, 8].map((y) => <circle key={`${x}-${y}`} cx={x + 2} cy={y + 1} r="1.6" />))}
        </svg>
      </button>
    </motion.div>
  )
}

type Press = {
  id: string
  card: HTMLElement
  pointerId: number
  startX: number
  startY: number
  pointerX: number
  pointerY: number
  // Set once the pointer has moved far enough to be a drag, not a click.
  started: boolean
  // Where the card was lifted from, at the size it's drawn.
  box: { left: number; top: number; width: number; height: number }
  lastX: number
  lastTime: number
  velocity: number
  lean: number
  frame: number
  place: DropPlace | null
  stop: () => void
}

type Lifted = { id: string; left: number; top: number; width: number; height: number }

type PlanDragOptions = {
  // Holds the plan's rows: tracks marked with data-plan-row, holding cards
  // marked with data-card-id.
  container: RefObject<HTMLElement | null>
  onMove: (id: string, place: DropPlace) => void
  reduceMotion: boolean
}

// How far the pointer goes before a press becomes a drag.
const dragThreshold = 4

// Dragging cards within and between the rows of the plan (docs/card-layout.md
// § "Reordering the plan"). Motion's Reorder only reorders within one list,
// so this does it instead. The card stays in the plan, faded, and moves to
// wherever it would be dropped as the pointer goes, while a stand-in on top
// of the page follows the pointer. Once a frame, the stand-in leans back from
// the way it's going and the row under it scrolls when it's taken up to
// either end, as does the page at the top and bottom of the window. Let go,
// the stand-in settles into the card's place.
export function usePlanDrag({ container, onMove, reduceMotion }: PlanDragOptions) {
  const [lifted, setLifted] = useState<Lifted | null>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const rotate = useMotionValue(0)
  const scale = useMotionValue(1)
  const press = useRef<Press | null>(null)
  const latest = useRef({ onMove, reduceMotion })
  useLayoutEffect(() => {
    latest.current = { onMove, reduceMotion }
  })

  function rowAt(pointerY: number) {
    const rows = [...(container.current?.querySelectorAll<HTMLElement>('[data-plan-row]') ?? [])]
    let nearest: HTMLElement | null = null
    let nearestDistance = Number.POSITIVE_INFINITY
    for (const row of rows) {
      const rect = row.getBoundingClientRect()
      const distance = pointerY < rect.top ? rect.top - pointerY : pointerY > rect.bottom ? pointerY - rect.bottom : 0
      if (distance < nearestDistance) {
        nearest = row
        nearestDistance = distance
      }
    }
    return nearest
  }

  // The stand-in's box now, at the size it's drawn.
  function standInBox(state: Press) {
    const left = state.box.left + x.get()
    const top = state.box.top + y.get()
    return { left, right: left + state.box.width, top, bottom: top + state.box.height }
  }

  // Goes by the stand-in's middle against the other cards' middles, measured
  // from their offsets, which layout animations don't move, so cards sliding
  // out of the way don't change the answer.
  function findPlace(state: Press) {
    const row = rowAt(state.pointerY)
    if (!row) return
    const standIn = standInBox(state)
    const middle = (standIn.left + standIn.right) / 2
    const start = row.getBoundingClientRect().left + row.clientLeft - row.scrollLeft
    const index = [...row.querySelectorAll<HTMLElement>(':scope > [data-card-id]')].filter(
      (card) => card.dataset.cardId !== state.id && start + card.offsetLeft + card.offsetWidth / 2 < middle,
    ).length
    const place = { row: row.dataset.planRow ?? '', index }
    if (state.place?.row === place.row && state.place.index === place.index) return
    state.place = place
    latest.current.onMove(state.id, place)
  }

  function step(time: number) {
    const state = press.current
    if (!state?.started) return
    const seconds = Math.max(0.001, (time - state.lastTime) / 1000)
    // Smoothed, so the lean doesn't twitch with every uneven mouse move.
    const speed = (state.pointerX - state.lastX) / seconds
    state.velocity += (speed - state.velocity) * Math.min(1, seconds * 12)
    state.lastX = state.pointerX
    state.lastTime = time

    const lean = dragLean(state.velocity)
    if (Math.abs(lean - state.lean) >= 0.1 || (lean === 0 && state.lean !== 0)) {
      state.lean = lean
      animate(rotate, lean, dragSpring)
    }

    const standIn = standInBox(state)
    const row = rowAt(state.pointerY)
    if (row) {
      const scroll = edgeScrollSpeed(standIn, row.getBoundingClientRect(), state.pointerX - state.startX)
      if (scroll) row.scrollLeft += scroll * seconds
    }
    const pageScroll = edgeScrollSpeed(
      { left: standIn.top, right: standIn.bottom },
      { left: 0, right: window.innerHeight },
      state.pointerY - state.startY,
    )
    if (pageScroll) window.scrollBy(0, pageScroll * seconds)

    findPlace(state)
    state.frame = requestAnimationFrame(step)
  }

  function lift(state: Press) {
    const box = cardBox(state.card)
    const width = state.card.offsetWidth
    const height = state.card.offsetHeight
    state.started = true
    state.box = box
    state.lastTime = performance.now()
    x.set(0)
    y.set(0)
    rotate.set(box.rotate ?? 0)
    scale.set(box.width / width)
    // The stand-in is laid out at the card's own size, scaled up to match it
    // if it's grown on hover, and turned about its middle as the cards are.
    setLifted({
      id: state.id,
      left: box.left + box.width / 2 - width / 2,
      top: box.top + box.height / 2 - height / 2,
      width,
      height,
    })
    // The card left in the plan sits straight.
    animate(state.card, { rotate: 0, scale: 1 }, { duration: 0 })
    state.frame = requestAnimationFrame(step)
  }

  // Once a drag has been let go, the click it makes does nothing: not the
  // option on that side of the card, nor pressing the grip.
  function swallowClick() {
    const swallow = (event: MouseEvent) => {
      event.stopPropagation()
      event.preventDefault()
    }
    window.addEventListener('click', swallow, { capture: true, once: true })
    setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0)
  }

  function finish(drop: boolean) {
    const state = press.current
    if (!state) return
    state.stop()
    cancelAnimationFrame(state.frame)
    if (!state.started) {
      press.current = null
      return
    }
    if (drop) findPlace(state)
    swallowClick()

    function end() {
      press.current = null
      setLifted(null)
    }

    // Settles the stand-in over the card's place, from its offsets, as the
    // card itself may still be sliding there.
    const card = container.current?.querySelector<HTMLElement>(`[data-card-id="${CSS.escape(state.id)}"]`)
    const row = card?.parentElement
    if (!drop || !card || !row || latest.current.reduceMotion) {
      end()
      return
    }
    const rowRect = row.getBoundingClientRect()
    const left = rowRect.left + row.clientLeft + card.offsetLeft - row.scrollLeft
    const top = rowRect.top + row.clientTop + card.offsetTop - row.scrollTop
    const toX = left + card.offsetWidth / 2 - (state.box.left + state.box.width / 2)
    const toY = top + card.offsetHeight / 2 - (state.box.top + state.box.height / 2)
    animate(x, toX, settleSpring)
    animate(y, toY, settleSpring)
    animate(rotate, 0, settleSpring)
    animate(scale, 1, settleSpring).then(end)
  }

  // A mouse can drag a card from anywhere but a link; a touch only from the
  // grip.
  function pressCard(event: ReactPointerEvent<HTMLElement>, id: string) {
    if (event.button !== 0 || press.current) return
    const target = event.target instanceof Element ? event.target : null
    const onGrip = Boolean(target?.closest(`.${cardStyles.grip}`))
    if (onGrip) event.preventDefault()
    else if (event.pointerType === 'touch' || target?.closest('a')) return
    // A touch is held by the grip it started on, which goes when the card
    // moves to another row, so it's let go to reach the window instead.
    if (target?.hasPointerCapture?.(event.pointerId)) target.releasePointerCapture(event.pointerId)

    const pointerId = event.pointerId
    function move(moveEvent: PointerEvent) {
      const state = press.current
      if (!state || moveEvent.pointerId !== pointerId) return
      state.pointerX = moveEvent.clientX
      state.pointerY = moveEvent.clientY
      const dx = state.pointerX - state.startX
      const dy = state.pointerY - state.startY
      if (!state.started) {
        if (Math.hypot(dx, dy) < dragThreshold) return
        lift(state)
      }
      x.set(dx)
      y.set(dy)
      findPlace(state)
    }
    function up(upEvent: PointerEvent) {
      if (upEvent.pointerId === pointerId) finish(upEvent.type === 'pointerup')
    }
    // Dragging over the page doesn't select its text.
    function noSelecting(selectEvent: Event) {
      selectEvent.preventDefault()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    document.addEventListener('selectstart', noSelecting)

    press.current = {
      id,
      card: event.currentTarget,
      pointerId,
      startX: event.clientX,
      startY: event.clientY,
      pointerX: event.clientX,
      pointerY: event.clientY,
      started: false,
      box: { left: 0, top: 0, width: 0, height: 0 },
      lastX: event.clientX,
      lastTime: 0,
      velocity: 0,
      lean: 0,
      frame: 0,
      place: null,
      stop() {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        window.removeEventListener('pointercancel', up)
        document.removeEventListener('selectstart', noSelecting)
      },
    }
  }

  useEffect(
    () => () => {
      const state = press.current
      if (!state) return
      state.stop()
      cancelAnimationFrame(state.frame)
    },
    [],
  )

  return { liftedId: lifted?.id ?? null, lifted, pressCard, standIn: { x, y, rotate, scale } }
}

type StandInProps = {
  lifted: Lifted
  motionValues: {
    x: MotionValue<number>
    y: MotionValue<number>
    rotate: MotionValue<number>
    scale: MotionValue<number>
  }
  children: ReactNode
}

// The card following the pointer while it's dragged, above the page, so the
// plan's rows don't clip it.
export function DragStandIn({ lifted, motionValues, children }: StandInProps) {
  return createPortal(
    <motion.div
      className={`${cardStyles.card} ${cardStyles.flying} ${cardStyles.dragging}`}
      style={{ left: lifted.left, top: lifted.top, width: lifted.width, height: lifted.height, ...motionValues }}
      aria-hidden="true"
    >
      {children}
    </motion.div>,
    document.body,
  )
}

const dragSpring = { type: 'spring', stiffness: 300, damping: 24 } as const
const settleSpring = { type: 'spring', stiffness: 500, damping: 40 } as const
