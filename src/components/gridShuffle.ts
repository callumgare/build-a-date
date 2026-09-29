'use client'

import { type RefObject, useEffect, useLayoutEffect, useRef } from 'react'
import { shrinkOf } from './shrink'

// Shuffling the cards of a grid into their new places when it gains or loses
// a column, rather than jumping there (docs/card-layout.md § "Shuffling to a
// new number of columns").
//
// Motion's layout animations only run when React renders, and a grid that
// narrows as the window does changes before React knows anything about it.
// So each grid's column count is watched instead. Where each item was is
// remembered after every render, and whenever the grid's size changes; when
// the column count changes, each item is animated from where it was to its
// new place, with the CSS translate property. That's separate from the
// transform Motion animates, so the two add up rather than fight.
//
// Places are offsets within the grid's section, which are in the section's
// own units, so they're right inside a shrunk column too, and a whole grid
// moving over as it re-centres counts.

type Place = { x: number; y: number }

type Tracked = { columns: number; places: WeakMap<HTMLElement, Place> }

// The grids under the root: the deck's, and the plan's rows.
const gridSelector = '.card-grid, .plan-track'

// How long a shuffle takes, and how it eases.
export const shuffleTiming: KeyframeAnimationOptions = {
  duration: 450,
  easing: 'cubic-bezier(0.3, 0.7, 0.2, 1)',
}

// How many columns a grid of cards is laid out in right now: its --columns,
// which styles.css registers as a whole number so it can be read here. 1
// for a row of the plan that runs down in a column. Where --columns can't be
// read as a number, the cards on its first line are counted.
export function columnCount(grid: HTMLElement) {
  const style = getComputedStyle(grid)
  if (style.flexDirection === 'column') return 1
  const columns = Number.parseInt(style.getPropertyValue('--columns'), 10)
  if (columns > 0) return columns
  const items = [...grid.children].filter((child): child is HTMLElement => child instanceof HTMLElement)
  return Math.max(1, items.filter((item) => item.offsetTop === items[0]?.offsetTop).length)
}

// Where an item sits within its grid's section, from offsets, which the
// animations don't move.
export function placeOf(item: HTMLElement, grid: HTMLElement): Place {
  return { x: grid.offsetLeft + item.offsetLeft, y: grid.offsetTop + item.offsetTop }
}

// How an item gets to its new place, from `from` (in its column's own units)
// away: sliding, when it's on screen before and after; fading in, when it
// arrives on screen from off it, which as a slide would come flying in from
// beyond the edge of the window; or just being there, when it ends up off
// screen.
function moveFor(item: HTMLElement, from: Place): 'slide' | 'fade' | 'none' {
  const box = item.getBoundingClientRect()
  const onScreen = (top: number) => top + box.height > 0 && top < window.innerHeight
  const before = box.top + from.y * shrinkOf(item)
  if (!onScreen(box.top)) return 'none'
  return onScreen(before) ? 'slide' : 'fade'
}

// How far an item's translate is from nothing at the moment, part way
// through a shuffle.
function currentShift(item: HTMLElement): Place {
  const [x = '0', y = '0'] = getComputedStyle(item).translate.split(/\s+/)
  return { x: Number.parseFloat(x) || 0, y: Number.parseFloat(y) || 0 }
}

// The items of a grid that take part: those laid out in it, not ones held in
// place over it (a card fading out of the deck, the slot a card flies onto).
function itemsOf(grid: HTMLElement) {
  return [...grid.children].filter(
    (child): child is HTMLElement => child instanceof HTMLElement && getComputedStyle(child).position !== 'absolute',
  )
}

// Each time `holdKey` changes, each grid keeps the number of columns it had
// until `holdUntil` says the change is over, however its width changes, and
// then shuffles to its new number. For a column growing or shrinking on a
// narrow screen: shuffling part way through, while the column scales, sends
// cards a long way across a column that's itself moving, so it's done once
// it's finished. Letting go is outside a render, so Motion doesn't see the
// grid change and animate it as well.
export function useGridShuffle(
  root: RefObject<HTMLElement | null>,
  {
    disabled,
    holdKey,
    holdUntil,
  }: { disabled: boolean; holdKey: string; holdUntil?: (root: HTMLElement) => Promise<void> },
) {
  const tracked = useRef(new Map<HTMLElement, Tracked>())
  const observer = useRef<ResizeObserver | null>(null)
  const latest = useRef({ disabled })
  useLayoutEffect(() => {
    latest.current = { disabled }
  })

  function remember(grid: HTMLElement, state: Tracked) {
    for (const item of itemsOf(grid)) state.places.set(item, placeOf(item, grid))
  }

  function shuffle(grid: HTMLElement, state: Tracked) {
    for (const item of itemsOf(grid)) {
      const was = state.places.get(item)
      if (!was) continue
      const now = placeOf(item, grid)
      const shift = currentShift(item)
      const from = { x: was.x + shift.x - now.x, y: was.y + shift.y - now.y }
      for (const animation of item.getAnimations()) {
        if (animation.id === 'grid-shuffle') animation.cancel()
      }
      if (Math.abs(from.x) < 1 && Math.abs(from.y) < 1) continue
      const move = moveFor(item, from)
      if (move === 'slide') {
        item.animate([{ translate: `${from.x}px ${from.y}px` }, { translate: '0px 0px' }], {
          ...shuffleTiming,
          id: 'grid-shuffle',
        })
      } else if (move === 'fade') {
        item.animate([{ opacity: 0 }, { opacity: 1 }], { ...shuffleTiming, id: 'grid-shuffle' })
      }
    }
  }

  // Pins a grid to its columns now, and so no wider than that many cards.
  function hold(grid: HTMLElement, state: Tracked) {
    grid.style.setProperty('--columns', String(state.columns))
  }

  function letGo(grid: HTMLElement, state: Tracked) {
    remember(grid, state)
    grid.style.removeProperty('--columns')
    const columns = columnCount(grid)
    if (columns !== state.columns && !latest.current.disabled) shuffle(grid, state)
    state.columns = columns
    remember(grid, state)
  }

  const heldBefore = useRef(false)
  const lastHoldKey = useRef(holdKey)
  // biome-ignore lint/correctness/useExhaustiveDependencies: hold and letGo only read refs
  useLayoutEffect(() => {
    if (holdKey === lastHoldKey.current) return
    lastHoldKey.current = holdKey
    if (!heldBefore.current) {
      heldBefore.current = true
      for (const [grid, state] of tracked.current) hold(grid, state)
    }
    const element = root.current
    let current = true
    const over = element && holdUntil ? holdUntil(element) : Promise.resolve()
    over.then(() => {
      if (!current) return
      heldBefore.current = false
      for (const [grid, state] of tracked.current) letGo(grid, state)
    })
    return () => {
      current = false
    }
  }, [holdKey])

  function resized(entries: ResizeObserverEntry[]) {
    for (const entry of entries) {
      const grid = entry.target as HTMLElement
      const state = tracked.current.get(grid)
      if (!state) continue
      const columns = columnCount(grid)
      if (columns !== state.columns && !latest.current.disabled) shuffle(grid, state)
      state.columns = columns
      remember(grid, state)
    }
  }

  // Forgets everything when unmounted, so a remount starts watching afresh.
  useEffect(
    () => () => {
      observer.current?.disconnect()
      observer.current = null
      tracked.current.clear()
    },
    [],
  )

  // After every render: start watching any new grid, and remember where
  // everything is now, cards added, removed or moved included. A grid whose
  // columns have changed since last time is left to the resize, which will
  // shuffle it from where things were.
  useLayoutEffect(() => {
    const container = root.current
    if (!container || typeof ResizeObserver === 'undefined') return
    observer.current ??= new ResizeObserver(resized)
    const grids = new Set(container.querySelectorAll<HTMLElement>(gridSelector))
    for (const [grid] of tracked.current) {
      if (!grids.has(grid)) {
        observer.current.unobserve(grid)
        tracked.current.delete(grid)
      }
    }
    for (const grid of grids) {
      let state = tracked.current.get(grid)
      if (!state) {
        state = { columns: columnCount(grid), places: new WeakMap() }
        tracked.current.set(grid, state)
        observer.current.observe(grid)
        if (heldBefore.current) hold(grid, state)
      }
      if (columnCount(grid) === state.columns) remember(grid, state)
    }
  })
}
