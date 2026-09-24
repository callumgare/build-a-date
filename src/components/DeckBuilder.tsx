'use client'

import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react'
import Link from 'next/link'
import {
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { savePlan } from '@/lib/actions/plans'
import { arrangeDeck, type DeckSort, deckSorts, sortDeck } from '@/lib/deck-order'
import type { AccessState } from '@/lib/decks'
import type { DateCard } from '@/types'
import Card from './Card'
import cardStyles from './Card.module.css'
import CardNotes, { type Notes } from './CardNotes'
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

function selectionsMatch(first: string[], second: string[]) {
  return first.length === second.length && first.every((id, index) => id === second[index])
}

type DeckBuilderProps = {
  deckName: string
  shareId: string
  cards: DateCard[]
  // Shuffles the deck the same way on the server and in the browser.
  seed: number
  // Whether the visitor can edit the deck, has asked to, or neither.
  access?: AccessState
  editHref?: string
}

export default function DeckBuilder({
  deckName,
  shareId,
  cards: deckCards,
  seed,
  access = 'none',
  editHref,
}: DeckBuilderProps) {
  const arranged = useMemo(() => arrangeDeck(deckCards, seed), [deckCards, seed])
  const cardsById = useMemo(() => new Map(deckCards.map((card) => [card.id, card])), [deckCards])
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
  const [notesOpen, setNotesOpen] = useState<{ id: string; from: DOMRect } | null>(null)
  // Ratings and notes as they stand after any changes made on this visit.
  const [notesById, setNotesById] = useState(
    () =>
      new Map<string, Notes>(
        deckCards.map((card) => [card.id, { interest: card.interest ?? null, notes: card.notes ?? '' }]),
      ),
  )
  // The card showing its buttons after a tap, for screens without hover.
  const [revealedId, setRevealedId] = useState<string | null>(null)
  const [sort, setSort] = useState<DeckSort>('random')
  // Ratings changed on this visit move the card straight away.
  const cards = useMemo(
    () =>
      sortDeck(sort, {
        added: deckCards,
        arranged,
        interest: (id) => notesById.get(id)?.interest ?? null,
      }),
    [sort, deckCards, arranged, notesById],
  )
  const dialogReference = useRef<HTMLDialogElement>(null)
  const trackReference = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()

  const tags = useMemo(() => [...new Set(deckCards.flatMap((card) => card.tags))].sort(), [deckCards])

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
    const deckCard = deckCardElement(card.id)
    if (deckCard) selectCard(card.id, deckCard.getBoundingClientRect())
    else setSelectedIds((currentIds) => [...currentIds, card.id])
  }

  function deckCardElement(id: string) {
    return document.querySelector(`[data-deck-card-id="${CSS.escape(id)}"]`)
  }

  // The card wherever it is now, in the plan or the deck.
  function cardElement(id: string) {
    return document.querySelector(`[data-card-id="${CSS.escape(id)}"], [data-deck-card-id="${CSS.escape(id)}"]`)
  }

  function openNotes(id: string) {
    const element = cardElement(id)
    if (!element) return
    setRevealedId(null)
    setNotesOpen({ id, from: element.getBoundingClientRect() })
  }

  // A click on either half of a card does what's written on that side
  // (docs/card-notes.md § "Card actions"). Without hover the first tap only
  // shows the options, so it can't add or discard the card by accident.
  function clickCard(id: string, event: ReactMouseEvent<HTMLElement>, actions: SideActions) {
    if (event.target instanceof Element && event.target.closest('button, a')) return
    if (!window.matchMedia('(hover: hover)').matches && revealedId !== id) {
      setRevealedId(id)
      return
    }
    actions[sideOf(event)]()
  }

  const changeNotes = useCallback((id: string, notes: Notes) => {
    setNotesById((current) => new Map(current).set(id, notes))
  }, [])

  // Tapping anywhere else hides the buttons a tap revealed.
  useEffect(() => {
    if (!revealedId) return
    function hide(event: PointerEvent) {
      if (!(event.target instanceof Element) || !event.target.closest("[data-revealed='true']")) setRevealedId(null)
    }
    document.addEventListener('pointerdown', hide)
    return () => document.removeEventListener('pointerdown', hide)
  }, [revealedId])

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
  const notesCard = notesOpen && cardsById.get(notesOpen.id)

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
                const actions: SideActions = { primary: () => removeCard(card.id), notes: () => openNotes(card.id) }

                return (
                  <motion.div
                    className={`${cardStyles.card} ${flight?.id === card.id || notesOpen?.id === card.id ? cardStyles.inFlight : ''}`}
                    key={card.id}
                    data-card-id={card.id}
                    data-revealed={revealedId === card.id}
                    layout
                    layoutId={`card-${card.id}`}
                    transition={transition}
                    onClick={(event) => clickCard(card.id, event, actions)}
                    onPointerMove={showHoveredSide}
                    onPointerLeave={clearHoveredSide}
                  >
                    <Card
                      card={card}
                      frame={frameFor(card.id)}
                      actions={<CardActions title={card.title} primary="Discard" actions={actions} />}
                    />
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
            <span className="filter-label">Show</span>
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

          <fieldset className="filters sort-options" aria-label="Sort ideas">
            <span className="filter-label">Sort by</span>
            {deckSorts.map((option) => (
              <button
                className="filter-button"
                data-active={sort === option.value}
                type="button"
                key={option.value}
                onClick={() => setSort(option.value)}
                aria-pressed={sort === option.value}
              >
                {option.label}
              </button>
            ))}
          </fieldset>

          <motion.div className="card-grid" layout>
            <AnimatePresence initial={false} mode="popLayout">
              {availableCards.map((card) => {
                const actions: SideActions = {
                  primary: () => {
                    const deckCard = deckCardElement(card.id)
                    if (deckCard) selectCard(card.id, deckCard.getBoundingClientRect())
                  },
                  notes: () => openNotes(card.id),
                }

                // Hovering (or a tap, without hover) shows what can be done
                // with the card (docs/card-notes.md § "Card actions").
                return (
                  <motion.div
                    className={`${cardStyles.card} ${notesOpen?.id === card.id ? cardStyles.inFlight : ''}`}
                    key={card.id}
                    data-deck-card-id={card.id}
                    data-revealed={revealedId === card.id}
                    layout
                    layoutId={`card-${card.id}`}
                    initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={reduceMotion ? undefined : { opacity: 0, scale: 0.96 }}
                    transition={transition}
                    onClick={(event) => clickCard(card.id, event, actions)}
                    onPointerMove={showHoveredSide}
                    onPointerLeave={clearHoveredSide}
                  >
                    <Card
                      card={card}
                      frame={frameFor(card.id)}
                      actions={<CardActions title={card.title} primary="Add to plan" actions={actions} />}
                    />
                  </motion.div>
                )
              })}
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

      {notesOpen && notesCard && (
        <CardNotes
          key={notesOpen.id}
          card={notesCard}
          frame={frameFor(notesCard.id)}
          shareId={shareId}
          initial={notesById.get(notesCard.id) ?? { interest: null, notes: '' }}
          from={notesOpen.from}
          returnTo={() => cardElement(notesCard.id)?.getBoundingClientRect() ?? null}
          reduceMotion={Boolean(reduceMotion)}
          onChange={(notes) => changeNotes(notesCard.id, notes)}
          onClosed={() => setNotesOpen(null)}
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
        {editHref ? (
          <Link className="text-action" href={editHref}>
            Edit this deck
          </Link>
        ) : access === 'pending' ? (
          <span className="muted">You&apos;ve asked to edit this deck</span>
        ) : (
          <Link className="text-action" href={`/d/${shareId}/request`}>
            Request edit access
          </Link>
        )}
        <Link className="text-action" href="/">
          Make your own deck with Build-a-Date
        </Link>
      </footer>
    </main>
  )
}

type Side = 'primary' | 'notes'
type SideActions = Record<Side, () => void>

// Add to plan or Discard is on the left half of a card, Notes on the right.
function sideOf(event: { clientX: number; currentTarget: Element }): Side {
  const rect = event.currentTarget.getBoundingClientRect()
  return event.clientX < rect.left + rect.width / 2 ? 'primary' : 'notes'
}

// Marks which option a click would pick, so its label can go bold. Set on the
// element directly, as it changes with every move of the mouse. Nothing is
// marked over a link, since a click there follows the link instead.
function showHoveredSide(event: ReactPointerEvent<HTMLElement>) {
  if (event.pointerType === 'touch') return
  const overLink = event.target instanceof Element && event.target.closest('a')
  if (overLink) delete event.currentTarget.dataset.side
  else event.currentTarget.dataset.side = sideOf(event)
}

function clearHoveredSide(event: ReactPointerEvent<HTMLElement>) {
  delete event.currentTarget.dataset.side
}

type CardActionsProps = {
  title: string
  primary: 'Add to plan' | 'Discard'
  actions: SideActions
}

// The options in a card's top band (docs/card-notes.md § "Card actions").
// Clicking a card does the same as the label on that side; the labels are
// buttons too, for the keyboard. Labels start with the words on the button,
// for voice control.
function CardActions({ title, primary, actions }: CardActionsProps) {
  return (
    <>
      <button
        className={`${cardStyles.action} ${cardStyles.primaryAction}`}
        type="button"
        aria-label={`${primary}: ${title}`}
        onClick={actions.primary}
      >
        {primary}
      </button>
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
