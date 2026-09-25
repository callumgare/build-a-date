'use client'

import { AnimatePresence, LayoutGroup, motion, Reorder, useDragControls, useReducedMotion } from 'motion/react'
import Link from 'next/link'
import {
  type ComponentProps,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { savePlan, updatePlan } from '@/lib/actions/plans'
import { saveDeckSort } from '@/lib/actions/preferences'
import { arrangeDeck, type DeckSort, deckSorts, keepArrangement, sortDeck } from '@/lib/deck-order'
import type { AccessState } from '@/lib/decks'
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
import AddCardControls from './decks/AddCardControls'
import PlanList, { type PlanSummary } from './decks/PlanList'
import { useCardEditor } from './decks/useCardEditor'
import FlyingCard from './FlyingCard'
import { frameFor } from './frames'
import InstallHint from './InstallHint'
import { readPicks, writePicks } from './keptPicks'
import Stars from './Stars'
import type { Box } from './tilt'

type DeckBuilderProps = {
  deckName: string
  shareId: string
  cards: DateCard[]
  // Shuffles the deck the same way on the server and in the browser.
  seed: number
  // Whether the visitor can edit the deck, has asked to, or neither.
  access?: AccessState
  editHref?: string
  // Only for owners and editors, who can change the cards from here too.
  deckId?: string
  // The sort to start on, and whether a new pick is saved to the visitor's
  // account, which only signed-in visitors have (docs/deck-sorting.md §
  // "Remembering the choice").
  initialSort?: DeckSort
  remembersSort?: boolean
  // A saved plan to start from, which Done then saves over rather than
  // making a new one (docs/plans.md § "Editing a plan").
  plan?: { id: string; cardIds: string[] }
  // The deck's plans, only for owners and editors, as on the deck's page.
  plans?: PlanSummary[]
}

function planUrl(planId: string) {
  return new URL(`/p/${planId}`, window.location.origin).href
}

export default function DeckBuilder({
  deckName,
  shareId,
  cards: deckCards,
  seed,
  access = 'none',
  editHref,
  deckId,
  initialSort = 'random',
  remembersSort = false,
  plan,
  plans,
}: DeckBuilderProps) {
  const [arranged, setArranged] = useState(() => arrangeDeck(deckCards, seed))
  const [arrangedFrom, setArrangedFrom] = useState(deckCards)
  // The picks, in the plan's order. The server can't see what this browser
  // kept, so they start as the saved plan, or empty, and what was kept is
  // read in before the first paint.
  const [selectedIds, setSelectedIds] = useState<string[]>(() => plan?.cardIds ?? [])
  // Cards edited from here come back from the server, which shouldn't
  // reshuffle the deck. A card that's been deleted drops out of the plan.
  if (arrangedFrom !== deckCards) {
    setArrangedFrom(deckCards)
    setArranged(keepArrangement(arranged, deckCards))
    const inDeck = new Set(deckCards.map((card) => card.id))
    setSelectedIds((currentIds) => currentIds.filter((id) => inDeck.has(id)))
  }
  const cardsById = useMemo(() => new Map(deckCards.map((card) => [card.id, card])), [deckCards])
  const picksPlace = useMemo(() => ({ shareId, planId: plan?.id }), [shareId, plan?.id])
  const [picksRead, setPicksRead] = useState(false)
  // Bumped when the kept picks change the plan, which lays the cards out
  // afresh rather than flying them up from the deck.
  const [layoutGeneration, setLayoutGeneration] = useState(0)
  // The plan as last saved. While editing a plan, Done shares its link until
  // something changes.
  const [saved, setSaved] = useState<{ key: string; planId: string } | null>(() =>
    plan ? { key: plan.cardIds.join(','), planId: plan.id } : null,
  )
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [activeTags, setActiveTags] = useState<Set<string>>(() => new Set())
  const [linkCopied, setLinkCopied] = useState(false)
  const [flight, setFlight] = useState<{ id: string; from: Box } | null>(null)
  const [notesOpen, setNotesOpen] = useState<{ id: string; from: Box } | null>(null)
  // Ratings and notes as they stand after any changes made on this visit.
  const [notesById, setNotesById] = useState(
    () =>
      new Map<string, Notes>(
        deckCards.map((card) => [card.id, { interest: card.interest ?? null, notes: card.notes ?? '' }]),
      ),
  )
  const { revealedId, setRevealedId, clickCard } = useCardTaps()
  const [sort, setSort] = useState<DeckSort>(initialSort)
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
  // The card moved from the keyboard, whose grip gets focus back afterwards.
  const [movedId, setMovedId] = useState<string | null>(null)
  const reduceMotion = useReducedMotion()

  const tags = useMemo(() => [...new Set(deckCards.flatMap((card) => card.tags))].sort(), [deckCards])
  const cardEditor = useCardEditor(deckId, tags)

  const availableCards = cards.filter(
    (card) => !selectedIds.includes(card.id) && [...activeTags].every((tag) => card.tags.includes(tag)),
  )

  // Kept picks go straight into the plan, before the browser paints, with no
  // animation (docs/plans.md § "Picks are kept in the browser").
  // biome-ignore lint/correctness/useExhaustiveDependencies: only what was kept when the page opened
  useLayoutEffect(() => {
    const kept = readPicks(picksPlace, cardsById)
    if (kept && kept.join(',') !== selectedIds.join(',')) {
      setSelectedIds(kept)
      setLayoutGeneration((generation) => generation + 1)
    }
    setPicksRead(true)
  }, [])

  // Nothing is kept when there's nothing unsaved: no picks, or the plan as it
  // was last saved. So once Done has saved a new plan, the deck starts empty
  // next time (docs/plans.md § "Picks are kept in the browser").
  const baselineKey = saved?.key ?? ''
  useEffect(() => {
    if (!picksRead) return
    writePicks(picksPlace, selectedIds.join(',') === baselineKey ? null : selectedIds)
  }, [picksRead, picksPlace, selectedIds, baselineKey])

  function selectCard(id: string, from: Box) {
    if (!reduceMotion) setFlight({ id, from })
    setSelectedIds((currentIds) => (currentIds.includes(id) ? currentIds : [...currentIds, id]))
  }

  // Picks from the ideas the current filters show, flying it up from its
  // place in the deck like a clicked card.
  function selectRandomCard() {
    if (availableCards.length === 0) return
    const card = availableCards[Math.floor(Math.random() * availableCards.length)]
    const deckCard = deckCardElement(card.id)
    if (deckCard) selectCard(card.id, cardBox(deckCard))
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
    setNotesOpen({ id, from: cardBox(element) })
  }

  const changeNotes = useCallback((id: string, notes: Notes) => {
    setNotesById((current) => new Map(current).set(id, notes))
  }, [])

  function editCard(card: DateCard) {
    setRevealedId(null)
    cardEditor.editCard(card)
  }

  function removeCard(id: string) {
    setSelectedIds((currentIds) => currentIds.filter((selectedId) => selectedId !== id))
  }

  // Moves a card one place along the plan, from its grip with the arrow keys
  // (docs/card-layout.md § "Reordering the plan").
  function moveCard(id: string, by: -1 | 1) {
    setSelectedIds((currentIds) => {
      const from = currentIds.indexOf(id)
      const to = from + by
      if (from === -1 || to < 0 || to >= currentIds.length) return currentIds
      const nextIds = [...currentIds]
      nextIds.splice(from, 1)
      nextIds.splice(to, 0, id)
      return nextIds
    })
    setMovedId(id)
  }

  // React moves the card's element to its new place, which can take focus
  // off its grip.
  useEffect(() => {
    if (!movedId) return
    const grip = document.querySelector<HTMLElement>(`[data-card-id="${CSS.escape(movedId)}"] .${cardStyles.grip}`)
    if (grip && document.activeElement !== grip) grip.focus()
    setMovedId(null)
  }, [movedId])

  function toggleTag(tag: string) {
    setActiveTags((currentTags) => {
      const nextTags = new Set(currentTags)
      if (nextTags.has(tag)) nextTags.delete(tag)
      else nextTags.add(tag)
      return nextTags
    })
  }

  // Saving happens in the background. If it fails, the sort still applies on
  // this visit; it just isn't remembered for the next one.
  function chooseSort(nextSort: DeckSort) {
    if (nextSort === sort) return
    setSort(nextSort)
    if (remembersSort) saveDeckSort(nextSort).catch(() => {})
  }

  // Saves the plan under its own short link, then shares that. Pressing Done
  // again without changing the plan shares the same link. A plan being
  // edited is saved over, under the link it already had.
  async function sharePlan() {
    const key = selectedIds.join(',')
    let planId = saved?.key === key ? saved.planId : null

    if (!planId) {
      setSaving(true)
      setSaveError(null)
      try {
        const result = plan ? await updatePlan(plan.id, selectedIds) : await savePlan(shareId, selectedIds)
        if (!result.ok) {
          setSaveError(result.error)
          return
        }
        planId = result.data.planId
        setSaved({ key, planId })
      } catch {
        setSaveError("Couldn't save your plan. Check your connection and try again.")
        return
      } finally {
        setSaving(false)
      }
    }

    const shareUrl = planUrl(planId)
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
      await navigator.clipboard.writeText(planUrl(saved.planId))
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
  const showActions = Boolean(plan) || selectedIds.length > 0
  const flyingCard = flight && cardsById.get(flight.id)
  const notesCard = notesOpen && cardsById.get(notesOpen.id)

  return (
    <main className="page-shell">
      <InstallHint />

      <header className="hero">
        <h1>{deckName}</h1>
        {plan && <p className="lede">Editing a plan</p>}
      </header>

      <Stars />

      {/* A new group for kept picks, so the cards that were in the deck have
          nothing to fly up from. */}
      <LayoutGroup id={`date-builder-${layoutGeneration}`} key={layoutGeneration}>
        <section className="plan-section" aria-label="Your plan">
          {/* Always laid out, so the first pick doesn't push the page down;
              hidden (and inert) until there's a plan to act on. While editing
              a plan they always show, so Cancel is there even once it's
              emptied (docs/plans.md § "Editing a plan"). */}
          <div className="plan-actions" data-visible={showActions} inert={!showActions}>
            <button
              className="done-button"
              type="button"
              onClick={sharePlan}
              disabled={saving || selectedIds.length === 0}
            >
              {saving ? 'Saving…' : plan ? 'Update Plan' : 'Done'}
            </button>
            {plan && (
              // Unsaved changes are dropped, so the edit page starts from the
              // saved plan next time.
              <Link className="text-action" href={`/p/${plan.id}`} onClick={() => writePicks(picksPlace, null)}>
                Cancel
              </Link>
            )}
            <button className="text-action" type="button" onClick={() => setSelectedIds([])}>
              Clear plan
            </button>
          </div>
          {saveError && (
            <p className="form-error" role="alert">
              {saveError}
            </p>
          )}

          {/* Cards in the plan are dragged by their grip to reorder it
              (docs/card-layout.md § "Reordering the plan"). */}
          <Reorder.Group
            as="div"
            axis="x"
            className="plan-track"
            ref={trackReference}
            values={selectedIds}
            onReorder={setSelectedIds}
            layoutScroll
          >
            <AnimatePresence initial={false} mode="popLayout">
              {selectedIds.map((id) => {
                const card = cardsById.get(id)
                if (!card) return null
                const actions: SideActions = { primary: () => removeCard(card.id), notes: () => openNotes(card.id) }

                return (
                  <PlanCard
                    className={`${cardStyles.card} ${flight?.id === card.id || notesOpen?.id === card.id ? cardStyles.inFlight : ''}`}
                    key={card.id}
                    value={card.id}
                    title={card.title}
                    data-card-id={card.id}
                    data-revealed={revealedId === card.id}
                    layoutId={`card-${card.id}`}
                    onPointerEnter={tiltCard}
                    transition={transition}
                    onClick={(event) => clickCard(card.id, event, actions)}
                    onPointerMove={showHoveredSide}
                    onPointerLeave={leaveCard}
                    onMove={(by) => moveCard(card.id, by)}
                  >
                    <Card
                      card={card}
                      frame={frameFor(card.id)}
                      actions={<CardActions title={card.title} primary="Discard" actions={actions} />}
                      scrawl={notesById.get(card.id)}
                    />
                    {deckId && <EditButton title={card.title} onClick={() => editCard(card)} />}
                  </PlanCard>
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
          </Reorder.Group>
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
                onClick={() => chooseSort(option.value)}
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
                    if (deckCard) selectCard(card.id, cardBox(deckCard))
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
                    onPointerEnter={tiltCard}
                    initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={reduceMotion ? undefined : { opacity: 0, scale: 0.96 }}
                    transition={transition}
                    onClick={(event) => clickCard(card.id, event, actions)}
                    onPointerMove={showHoveredSide}
                    onPointerLeave={leaveCard}
                  >
                    <Card
                      card={card}
                      frame={frameFor(card.id)}
                      actions={<CardActions title={card.title} primary="Add to plan" actions={actions} />}
                      scrawl={notesById.get(card.id)}
                    />
                    {deckId && <EditButton title={card.title} onClick={() => editCard(card)} />}
                  </motion.div>
                )
              })}
            </AnimatePresence>
            {deckId && (
              // The last spot in the deck, moving along with the cards.
              <motion.div layout transition={transition}>
                <AddCardControls onAdd={cardEditor.addCard} onQuickAdd={cardEditor.quickAdd} />
              </motion.div>
            )}
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

      {plans && (
        <section className="deck-plans" aria-label="Plans">
          <PlanList plans={plans} />
        </section>
      )}

      {flight && flyingCard && (
        <FlyingCard
          key={flight.id}
          card={flyingCard}
          frame={frameFor(flyingCard.id)}
          scrawl={notesById.get(flyingCard.id)}
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

      <dialog className="share-dialog" ref={dialogReference} onClose={() => setLinkCopied(false)}>
        <p>Share your date plan</p>
        <div className="share-dialog-actions">
          <button className="done-button" type="button" onClick={copyLink}>
            {linkCopied ? 'Copied!' : 'Copy link'}
          </button>
          {saved && (
            <a className="text-action" href={`/p/${saved.planId}`}>
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
      </footer>
    </main>
  )
}

type PlanCardProps = Omit<ComponentProps<typeof Reorder.Item<string, 'div'>>, 'as' | 'value'> & {
  value: string
  title: string
  onMove: (by: -1 | 1) => void
}

// A card in the plan, which a mouse can drag from anywhere on it. A touch
// only drags from the grip, so a swipe across the card still scrolls the plan
// (docs/card-layout.md § "Reordering the plan"). A press that doesn't move
// is still a click, but letting go of a drag isn't, anywhere on the card.
function PlanCard({ value, title, onMove, className, children, ...props }: PlanCardProps) {
  const dragControls = useDragControls()
  // Set as soon as the card starts moving. Motion's onDragEnd comes a frame
  // after the click that letting go makes, too late to stop it.
  const dragged = useRef(false)

  function startDrag(event: ReactPointerEvent<HTMLElement>) {
    dragged.current = false
    const target = event.target instanceof Element ? event.target : null
    const onGrip = Boolean(target?.closest(`.${cardStyles.grip}`))
    if (onGrip) event.preventDefault()
    else if (event.pointerType === 'touch' || target?.closest('a')) return
    dragControls.start(event)
  }

  function moveFromKeyboard(event: ReactKeyboardEvent) {
    const by = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : null
    if (!by) return
    event.preventDefault()
    onMove(by)
  }

  return (
    <Reorder.Item
      as="div"
      value={value}
      dragListener={false}
      dragControls={dragControls}
      onPointerDown={startDrag}
      onDragStart={() => {
        dragged.current = true
      }}
      // Caught on the way down, before the card or any button on it sees it.
      onClickCapture={(event) => {
        if (!dragged.current) return
        dragged.current = false
        event.stopPropagation()
        event.preventDefault()
      }}
      className={`${className} ${cardStyles.reorderable}`}
      {...props}
    >
      {children}
      <button
        className={cardStyles.grip}
        type="button"
        aria-label={`Move ${title}`}
        aria-description="Drag, or use the left and right arrow keys, to move it along the plan"
        onKeyDown={moveFromKeyboard}
      >
        <svg viewBox="0 0 24 12" aria-hidden="true">
          {[4, 10, 16].flatMap((x) => [2, 8].map((y) => <circle key={`${x}-${y}`} cx={x + 2} cy={y + 1} r="1.6" />))}
        </svg>
      </button>
    </Reorder.Item>
  )
}
