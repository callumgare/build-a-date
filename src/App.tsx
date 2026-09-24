import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react'
import cardData from './data/cards.json'
import Card from './components/Card'
import FlyingCard from './components/FlyingCard'
import cardStyles from './components/Card.module.css'
import { frameFor, type Frame } from './components/frames'
import type { DateCard } from './types'

const cards: DateCard[] = spreadFrames(shuffle(cardData))
const cardsById = new Map(cards.map((card) => [card.id, card]))

// A fresh order on every page load.
function shuffle<T>(items: T[]): T[] {
  const shuffled = [...items]
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swap = Math.floor(Math.random() * (index + 1))
    ;[shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]]
  }
  return shuffled
}

// Keeps matching frames apart: each card takes the next in the shuffle whose
// frame isn't among the last few placed, so neither the card beside it nor
// the one above it (the grid runs up to six columns) shares its frame. A
// frame with too many cards left to stay spread out goes first, so they
// don't bunch up at the end, and when no card fits, the gap shrinks.
function spreadFrames(shuffled: DateCard[]): DateCard[] {
  const remaining = [...shuffled]
  const spread: DateCard[] = []
  const left = new Map<Frame, number>()
  for (const card of shuffled) left.set(frameFor(card.id), (left.get(frameFor(card.id)) ?? 0) + 1)

  while (remaining.length > 0) {
    for (let gap = 6; gap >= 0; gap--) {
      const recent = new Set(spread.slice(Math.max(0, spread.length - gap)).map((card) => frameFor(card.id)))
      const fits = remaining.filter((card) => !recent.has(frameFor(card.id)))
      if (gap > 0 && fits.length === 0) continue
      const crowded = fits.find((card) => (left.get(frameFor(card.id)) ?? 0) * (gap + 1) > remaining.length)
      const card = crowded ?? fits[0] ?? remaining[0]
      remaining.splice(remaining.indexOf(card), 1)
      left.set(frameFor(card.id), (left.get(frameFor(card.id)) ?? 1) - 1)
      spread.push(card)
      break
    }
  }
  return spread
}

function readSelection(): string[] {
  const seen = new Set<string>()

  return window.location.hash
    .slice(1)
    .split(',')
    .map((id) => decodeURIComponent(id))
    .filter((id) => cardsById.has(id) && !seen.has(id) && Boolean(seen.add(id)))
}

// Cards are divs rather than buttons so their descriptions can hold links,
// so Enter and Space have to trigger them by hand.
function clickOnActivationKey(event: KeyboardEvent<HTMLElement>) {
  if (event.target !== event.currentTarget) return
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  event.currentTarget.click()
}

function selectionsMatch(first: string[], second: string[]) {
  return first.length === second.length && first.every((id, index) => id === second[index])
}

function App() {
  const [selectedIds, setSelectedIds] = useState(readSelection)
  const [activeTags, setActiveTags] = useState<Set<string>>(() => new Set())
  const [linkCopied, setLinkCopied] = useState(false)
  const [flight, setFlight] = useState<{ id: string; from: DOMRect } | null>(null)
  const dialogReference = useRef<HTMLDialogElement>(null)
  const trackReference = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()

  const tags = useMemo(
    () => [...new Set(cards.flatMap((card) => card.tags))].sort(),
    [],
  )

  const availableCards = cards.filter(
    (card) =>
      !selectedIds.includes(card.id) &&
      [...activeTags].every((tag) => card.tags.includes(tag)),
  )

  useEffect(() => {
    const encodedIds = selectedIds.map(encodeURIComponent).join(',')
    const nextUrl = `${window.location.pathname}${window.location.search}${encodedIds ? `#${encodedIds}` : ''}`
    window.history.replaceState(null, '', nextUrl)
  }, [selectedIds])

  useEffect(() => {
    function restoreSelection() {
      const restoredIds = readSelection()
      setSelectedIds((currentIds) =>
        selectionsMatch(currentIds, restoredIds) ? currentIds : restoredIds,
      )
    }

    window.addEventListener('hashchange', restoreSelection)
    return () => window.removeEventListener('hashchange', restoreSelection)
  }, [])

  function selectCard(id: string, from: DOMRect) {
    if (!reduceMotion) setFlight({ id, from })
    setSelectedIds((currentIds) =>
      currentIds.includes(id) ? currentIds : [...currentIds, id],
    )
  }

  // Picks from the ideas the current filters show, flying it up from its
  // place in the deck like a clicked card.
  function selectRandomCard() {
    if (availableCards.length === 0) return
    const card = availableCards[Math.floor(Math.random() * availableCards.length)]
    const deckCard = document.querySelector(`[data-deck-card-id="${CSS.escape(card.id)}"]`)
    if (deckCard) selectCard(card.id, deckCard.getBoundingClientRect())
    else setSelectedIds((currentIds) => [...currentIds, card.id])
  }

  function removeCard(id: string) {
    setSelectedIds((currentIds) => currentIds.filter((selectedId) => selectedId !== id))
  }

  function toggleTag(tag: string) {
    setActiveTags((currentTags) => {
      const nextTags = new Set(currentTags)
      if (nextTags.has(tag)) nextTags.delete(tag)
      else nextTags.add(tag)
      return nextTags
    })
  }

  async function sharePlan() {
    const shareUrl = window.location.href

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Build-a-Date', url: shareUrl })
        return
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
      }
    }

    setLinkCopied(false)
    dialogReference.current?.showModal()
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setLinkCopied(true)
    } catch {
      setLinkCopied(false)
    }
  }

  const transition = useMemo(
    () =>
      reduceMotion
        ? { duration: 0 }
        : { type: 'spring' as const, stiffness: 430, damping: 38, mass: 0.8 },
    [reduceMotion],
  )
  const endFlight = useCallback(() => setFlight(null), [])
  const flyingCard = flight && cardsById.get(flight.id)

  return (
    <main className="page-shell">
      <header className="hero">
        <h1>Build-a-Date</h1>
      </header>

      <div className="stars" aria-hidden="true">
        <img className="star star--1" src="/star-1.svg" alt="" />
        <img className="star star--2" src="/star-2.svg" alt="" />
        <img className="star star--3" src="/star-3.svg" alt="" />
        <img className="star star--4" src="/star-4.svg" alt="" />
        <img className="star star--5" src="/star-5.svg" alt="" />
        <img className="star star--6" src="/star-6.svg" alt="" />
        <img className="star star--7" src="/star-7.svg" alt="" />
      </div>

      <LayoutGroup id="date-builder">
        <section className="plan-section" aria-label="Your plan">
          {selectedIds.length > 0 && (
            <div className="plan-actions">
              <button className="done-button" type="button" onClick={sharePlan}>
                Done
              </button>
              <button className="text-action" type="button" onClick={() => setSelectedIds([])}>
                Clear plan
              </button>
            </div>
          )}

          <div className="plan-track" ref={trackReference} aria-label="Selected date ideas">
            <AnimatePresence initial={false} mode="popLayout">
              {selectedIds.map((id) => {
                const card = cardsById.get(id)
                if (!card) return null

                return (
                  <motion.div
                    className={`${cardStyles.card} ${flight?.id === card.id ? cardStyles.inFlight : ''}`}
                    key={card.id}
                    data-card-id={card.id}
                    layout
                    layoutId={`card-${card.id}`}
                    transition={transition}
                    role="button"
                    tabIndex={0}
                    onClick={() => removeCard(card.id)}
                    onKeyDown={clickOnActivationKey}
                    aria-label={`Remove ${card.title} from your plan`}
                  >
                    <Card card={card} frame={frameFor(card.id)} />
                  </motion.div>
                )
              })}
            </AnimatePresence>
            <motion.div className="empty-slot" layout transition={transition}>
              <span>Pick a card below</span>
              {availableCards.length > 0 && (
                <>
                  <span className="empty-slot-divider">or</span>
                  <button className="text-action" type="button" onClick={selectRandomCard}>
                    select a random one
                  </button>
                </>
              )}
            </motion.div>
          </div>
        </section>

        <section className="deck-section" aria-label="Date ideas">
          <div className="filters" aria-label="Filter ideas by tag">
            <button
              className="filter-button"
              data-active={activeTags.size === 0}
              type="button"
              onClick={() => setActiveTags(new Set())}
            >
              All
            </button>
            {tags.map((tag) => (
              <button
                className="filter-button"
                data-active={activeTags.has(tag)}
                type="button"
                key={tag}
                onClick={() => toggleTag(tag)}
                aria-pressed={activeTags.has(tag)}
              >
                {tag}
              </button>
            ))}
          </div>

          <motion.div className="card-grid" layout>
            <AnimatePresence initial={false} mode="popLayout">
              {availableCards.map((card) => (
                <motion.div
                  className={cardStyles.card}
                  key={card.id}
                  data-deck-card-id={card.id}
                  layout
                  layoutId={`card-${card.id}`}
                  initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={reduceMotion ? undefined : { opacity: 0, scale: 0.96 }}
                  transition={transition}
                  role="button"
                  tabIndex={0}
                  onClick={(event) => selectCard(card.id, event.currentTarget.getBoundingClientRect())}
                  onKeyDown={clickOnActivationKey}
                  aria-label={`Add ${card.title} to your plan`}
                >
                  <Card card={card} frame={frameFor(card.id)} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>

          {availableCards.length === 0 && (
            <div className="empty-results">
              <p>No ideas match every selected tag.</p>
              <button className="text-action" type="button" onClick={() => setActiveTags(new Set())}>
                Show all ideas
              </button>
            </div>
          )}
        </section>
      </LayoutGroup>

      {flight && flyingCard && (
        <FlyingCard
          key={flight.id}
          card={flyingCard}
          frame={frameFor(flyingCard.id)}
          from={flight.from}
          track={trackReference}
          transition={transition}
          onDone={endFlight}
        />
      )}

      <dialog
        className="share-dialog"
        ref={dialogReference}
        onClose={() => setLinkCopied(false)}
      >
        <p>Share your date plan</p>
        <div className="share-dialog-actions">
          <button className="done-button" type="button" onClick={copyLink}>
            {linkCopied ? 'Copied!' : 'Copy link'}
          </button>
          <button className="text-action" type="button" onClick={() => dialogReference.current?.close()}>
            Close
          </button>
        </div>
      </dialog>
    </main>
  )
}

export default App