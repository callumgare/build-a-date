'use client'

import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react'
import Link from 'next/link'
import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { savePlan } from '@/lib/actions/plans'
import { arrangeDeck } from '@/lib/deck-order'
import type { DateCard } from '@/types'
import Card from './Card'
import cardStyles from './Card.module.css'
import FlyingCard from './FlyingCard'
import { frameFor } from './frames'
import InstallHint from './InstallHint'
import Stars from './Stars'

function readSelection(cardsById: Map<string, DateCard>): string[] {
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

type DeckBuilderProps = {
  deckName: string
  shareId: string
  cards: DateCard[]
  // Shuffles the deck the same way on the server and in the browser.
  seed: number
}

export default function DeckBuilder({ deckName, shareId, cards: deckCards, seed }: DeckBuilderProps) {
  const cards = useMemo(() => arrangeDeck(deckCards, seed), [deckCards, seed])
  const cardsById = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards])
  // Picks in progress live in the URL hash, which only the browser can see,
  // so they're read in after the first render.
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const hashRead = useRef(false)
  const [saved, setSaved] = useState<{ key: string; url: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [activeTags, setActiveTags] = useState<Set<string>>(() => new Set())
  const [linkCopied, setLinkCopied] = useState(false)
  const [flight, setFlight] = useState<{ id: string; from: DOMRect } | null>(null)
  const dialogReference = useRef<HTMLDialogElement>(null)
  const trackReference = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()

  const tags = useMemo(() => [...new Set(cards.flatMap((card) => card.tags))].sort(), [cards])

  const availableCards = cards.filter(
    (card) => !selectedIds.includes(card.id) && [...activeTags].every((tag) => card.tags.includes(tag)),
  )

  useEffect(() => {
    if (!hashRead.current) return
    const encodedIds = selectedIds.map(encodeURIComponent).join(',')
    const nextUrl = `${window.location.pathname}${window.location.search}${encodedIds ? `#${encodedIds}` : ''}`
    window.history.replaceState(null, '', nextUrl)
  }, [selectedIds])

  useEffect(() => {
    function restoreSelection() {
      const restoredIds = readSelection(cardsById)
      setSelectedIds((currentIds) => (selectionsMatch(currentIds, restoredIds) ? currentIds : restoredIds))
    }

    restoreSelection()
    hashRead.current = true
    window.addEventListener('hashchange', restoreSelection)
    return () => window.removeEventListener('hashchange', restoreSelection)
  }, [cardsById])

  function selectCard(id: string, from: DOMRect) {
    if (!reduceMotion) setFlight({ id, from })
    setSelectedIds((currentIds) => (currentIds.includes(id) ? currentIds : [...currentIds, id]))
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

  // Saves the plan under its own short link, then shares that. Pressing Done
  // again without changing the plan shares the same link.
  async function sharePlan() {
    const key = selectedIds.join(',')
    let shareUrl = saved?.key === key ? saved.url : null

    if (!shareUrl) {
      setSaving(true)
      setSaveError(null)
      try {
        const result = await savePlan(shareId, selectedIds)
        if (!result.ok) {
          setSaveError(result.error)
          return
        }
        shareUrl = new URL(`/p/${result.data.planId}`, window.location.origin).href
        setSaved({ key, url: shareUrl })
      } catch {
        setSaveError("Couldn't save your plan. Check your connection and try again.")
        return
      } finally {
        setSaving(false)
      }
    }

    if (navigator.share) {
      try {
        await navigator.share({ title: deckName, url: shareUrl })
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
    if (!saved) return
    try {
      await navigator.clipboard.writeText(saved.url)
      setLinkCopied(true)
    } catch {
      setLinkCopied(false)
    }
  }

  const transition = useMemo(
    () => (reduceMotion ? { duration: 0 } : { type: 'spring' as const, stiffness: 430, damping: 38, mass: 0.8 }),
    [reduceMotion],
  )
  const endFlight = useCallback(() => setFlight(null), [])
  const flyingCard = flight && cardsById.get(flight.id)

  return (
    <main className="page-shell">
      <InstallHint />

      <header className="hero">
        <h1>{deckName}</h1>
      </header>

      <Stars />

      <LayoutGroup id="date-builder">
        <section className="plan-section" aria-label="Your plan">
          {/* Always laid out, so the first pick doesn't push the page down;
              hidden (and inert) until there's a plan to act on. */}
          <div className="plan-actions" data-visible={selectedIds.length > 0} inert={selectedIds.length === 0}>
            <button className="done-button" type="button" onClick={sharePlan} disabled={saving}>
              {saving ? 'Saving…' : 'Done'}
            </button>
            <button className="text-action" type="button" onClick={() => setSelectedIds([])}>
              Clear plan
            </button>
          </div>
          {saveError && (
            <p className="form-error" role="alert">
              {saveError}
            </p>
          )}

          <div className="plan-track" ref={trackReference}>
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
          <fieldset className="filters" aria-label="Filter ideas by tag">
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
          </fieldset>

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

      <dialog className="share-dialog" ref={dialogReference} onClose={() => setLinkCopied(false)}>
        <p>Share your date plan</p>
        <div className="share-dialog-actions">
          <button className="done-button" type="button" onClick={copyLink}>
            {linkCopied ? 'Copied!' : 'Copy link'}
          </button>
          {saved && (
            <a className="text-action" href={saved.url}>
              Open your plan
            </a>
          )}
          <button className="text-action" type="button" onClick={() => dialogReference.current?.close()}>
            Close
          </button>
        </div>
      </dialog>

      <footer className="site-footer">
        <Link className="text-action" href="/">
          Make your own deck with Build-a-Date
        </Link>
      </footer>
    </main>
  )
}
