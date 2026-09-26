'use client'

import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react'
import { nanoid } from 'nanoid'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { deletePlan, savePlan, updatePlan } from '@/lib/actions/plans'
import { saveDeckSort } from '@/lib/actions/preferences'
import { arrangeDeck, type DeckSort, deckSorts, keepArrangement, sortDeck } from '@/lib/deck-order'
import type { AccessState } from '@/lib/decks'
import {
  addCard,
  addGroup,
  changeGroup,
  firstRow,
  keepCards,
  moveCardBy,
  noPicks,
  pickedIds,
  picksKey,
  placeCard,
  removeCard as removeFromPicks,
  removeGroup,
} from '@/lib/plan-picks'
import type { DateCard, PlanPicks } from '@/types'
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
import { DragStandIn, PlanCard, usePlanDrag } from './PlanCard'
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
  // A saved plan to start from, which Update Plan then saves over rather than
  // making a new one (docs/plans.md § "Editing a plan").
  plan?: { id: string } & PlanPicks
  // The deck's plans, only for owners and editors, as on the deck's page.
  plans?: PlanSummary[]
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
  // The picks, row by row in the plan's order. The server can't see what
  // this browser kept, so they start as the saved plan, or empty, and what was
  // kept is read in before the first paint.
  const [picks, setPicks] = useState<PlanPicks>(() => (plan ? { cardIds: plan.cardIds, groups: plan.groups } : noPicks))
  const selectedIds = useMemo(() => pickedIds(picks), [picks])
  // Cards edited from here come back from the server, which shouldn't
  // reshuffle the deck. A card that's been deleted drops out of the plan.
  if (arrangedFrom !== deckCards) {
    setArrangedFrom(deckCards)
    setArranged(keepArrangement(arranged, deckCards))
    const inDeck = new Set(deckCards.map((card) => card.id))
    setPicks((current) => keepCards(current, (id) => inDeck.has(id)))
  }
  const cardsById = useMemo(() => new Map(deckCards.map((card) => [card.id, card])), [deckCards])
  const picksPlace = useMemo(() => ({ shareId, planId: plan?.id }), [shareId, plan?.id])
  const [picksRead, setPicksRead] = useState(false)
  // Bumped when the kept picks change the plan, which lays the cards out
  // afresh rather than flying them up from the deck.
  const [layoutGeneration, setLayoutGeneration] = useState(0)
  // The plan as last saved. While editing a plan, Update Plan shares its link until
  // something changes.
  const [saved, setSaved] = useState<{ key: string; planId: string } | null>(() =>
    plan ? { key: picksKey(plan), planId: plan.id } : null,
  )
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [activeTags, setActiveTags] = useState<Set<string>>(() => new Set())
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
  const trackReference = useRef<HTMLDivElement>(null)
  const planReference = useRef<HTMLElement>(null)
  // The card moved from the keyboard, whose grip gets focus back afterwards.
  const [movedId, setMovedId] = useState<string | null>(null)
  // A group just added, whose title gets focus.
  const [addedGroupId, setAddedGroupId] = useState<string | null>(null)
  const reduceMotion = useReducedMotion()
  const drag = usePlanDrag({
    container: planReference,
    onMove: (id, place) => setPicks((current) => placeCard(current, id, place.row, place.index)),
    reduceMotion: Boolean(reduceMotion),
  })
  const router = useRouter()

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
    if (kept && picksKey(kept) !== picksKey(picks)) {
      setPicks(kept)
      setLayoutGeneration((generation) => generation + 1)
    }
    setPicksRead(true)
  }, [])

  // Nothing is kept when there's nothing unsaved: no picks, or the plan as it
  // was last saved. So once Save plan has saved a new plan, the deck starts empty
  // next time (docs/plans.md § "Picks are kept in the browser").
  const baselineKey = saved?.key ?? picksKey(noPicks)
  useEffect(() => {
    if (!picksRead) return
    writePicks(picksPlace, picksKey(picks) === baselineKey ? null : picks)
  }, [picksRead, picksPlace, picks, baselineKey])

  // Onto the end of the plan's first row.
  function selectCard(id: string, from: Box) {
    if (!reduceMotion) setFlight({ id, from })
    setPicks((current) => addCard(current, id))
  }

  // Picks from the ideas the current filters show, flying it up from its
  // place in the deck like a clicked card.
  function selectRandomCard() {
    if (availableCards.length === 0) return
    const card = availableCards[Math.floor(Math.random() * availableCards.length)]
    const deckCard = deckCardElement(card.id)
    if (deckCard) selectCard(card.id, cardBox(deckCard))
    else setPicks((current) => addCard(current, card.id))
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
    setPicks((current) => removeFromPicks(current, id))
  }

  // Moves a card one place along its row, or onto the row above or below,
  // from its grip with the arrow keys (docs/card-layout.md § "Reordering the
  // plan").
  function moveCard(id: string, move: Parameters<typeof moveCardBy>[2]) {
    setPicks((current) => moveCardBy(current, id, move))
    setMovedId(id)
  }

  // A new, empty group at the bottom of the plan, ready for its title
  // (docs/plans.md § "Groups").
  function newGroup() {
    const id = nanoid(10)
    setPicks((current) => addGroup(current, id))
    setAddedGroupId(id)
  }

  useEffect(() => {
    if (!addedGroupId) return
    document.querySelector<HTMLElement>(`[data-group-id="${CSS.escape(addedGroupId)}"] input`)?.focus()
    setAddedGroupId(null)
  }, [addedGroupId])

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

  // Saves the plan under its own short link, then opens its page with the
  // share dialog showing (docs/plans.md § "Sharing a plan"). A plan being
  // edited is saved over, under the link it already had, and isn't saved
  // again if nothing has changed.
  async function sharePlan() {
    const key = picksKey(picks)
    let planId = saved?.key === key ? saved.planId : null
    setSaveError(null)

    if (!planId) {
      setSaving(true)
      try {
        const result = plan
          ? await updatePlan(plan.id, picks.cardIds, picks.groups)
          : await savePlan(shareId, picks.cardIds, picks.groups)
        if (!result.ok) {
          setSaveError(result.error)
          setSaving(false)
          return
        }
        planId = result.data.planId
        setSaved({ key, planId })
      } catch {
        setSaveError("Couldn't save your plan. Check your connection and try again.")
        setSaving(false)
        return
      }
    }

    // Saved now, so there's nothing left to keep: Create new plan starts
    // empty, and Edit plan starts from what was saved.
    writePicks(picksPlace, null)
    router.push(`/p/${planId}?share`)
  }

  // Deletes the plan being edited, once they've said yes, and goes back to the
  // deck to start a new one (docs/plans.md § "Deleting a plan").
  async function removePlan() {
    if (!plan) return
    if (!window.confirm("Delete this plan? Its link will stop working. This can't be undone.")) return
    setDeleting(true)
    setSaveError(null)
    try {
      const result = await deletePlan(plan.id)
      if (!result.ok) {
        setSaveError(result.error)
        setDeleting(false)
        return
      }
    } catch {
      setSaveError("Couldn't delete the plan. Check your connection and try again.")
      setDeleting(false)
      return
    }
    writePicks(picksPlace, null)
    router.push(`/d/${shareId}`)
  }

  const transition = useMemo(
    () => (reduceMotion ? { duration: 0 } : { type: 'spring' as const, stiffness: 430, damping: 38, mass: 0.8 }),
    [reduceMotion],
  )
  const endFlight = useCallback(() => setFlight(null), [])
  const showActions = Boolean(plan) || selectedIds.length > 0 || picks.groups.length > 0
  const flyingCard = flight && cardsById.get(flight.id)
  const notesCard = notesOpen && cardsById.get(notesOpen.id)
  const liftedCard = drag.lifted && cardsById.get(drag.lifted.id)

  function renderPlanCard(id: string) {
    const card = cardsById.get(id)
    if (!card) return null
    const actions: SideActions = { primary: () => removeCard(card.id), notes: () => openNotes(card.id) }

    return (
      <PlanCard
        className={`${cardStyles.card} ${flight?.id === card.id || notesOpen?.id === card.id ? cardStyles.inFlight : ''}`}
        key={card.id}
        title={card.title}
        lifted={drag.liftedId === card.id}
        data-card-id={card.id}
        data-revealed={revealedId === card.id}
        layoutId={`card-${card.id}`}
        onPointerEnter={tiltCard}
        transition={transition}
        onClick={(event) => clickCard(card.id, event, actions)}
        onPointerMove={showHoveredSide}
        onPointerLeave={leaveCard}
        onPress={(event) => drag.pressCard(event, card.id)}
        onMove={(move) => moveCard(card.id, move)}
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
  }

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
        <section className="plan-section" aria-label="Your plan" ref={planReference}>
          {/* Always laid out, so the first pick doesn't push the page down;
              hidden (and inert) until there's a plan to act on. While editing
              a plan they always show, so Cancel is there even once it's
              emptied (docs/plans.md § "Editing a plan"). */}
          <div className="plan-actions" data-visible={showActions} inert={!showActions}>
            <button
              className="done-button"
              type="button"
              onClick={sharePlan}
              disabled={saving || deleting || selectedIds.length === 0}
            >
              {saving ? 'Saving…' : plan ? 'Update Plan' : 'Save plan'}
            </button>
            {plan && (
              // Unsaved changes are dropped, so the edit page starts from the
              // saved plan next time.
              <Link className="text-action" href={`/p/${plan.id}`} onClick={() => writePicks(picksPlace, null)}>
                Cancel
              </Link>
            )}
            {plan ? (
              <button className="text-action" type="button" onClick={removePlan} disabled={saving || deleting}>
                {deleting ? 'Deleting…' : 'Delete plan'}
              </button>
            ) : (
              <button className="text-action" type="button" onClick={() => setPicks(noPicks)}>
                Clear plan
              </button>
            )}
          </div>
          {saveError && (
            <p className="form-error" role="alert">
              {saveError}
            </p>
          )}

          {/* Cards in the plan are dragged to reorder it, or onto another
              row (docs/card-layout.md § "Reordering the plan"). */}
          <motion.div
            className="plan-track"
            ref={trackReference}
            data-plan-row={firstRow}
            aria-label={picks.groups.length > 0 ? 'Not in a group' : undefined}
            role={picks.groups.length > 0 ? 'group' : undefined}
            layoutScroll
          >
            {/* No AnimatePresence: a card moved to another row would linger
                here as it left, and nothing in the plan has an exit animation.
                A discarded card still flies back to the deck by its layoutId. */}
            {picks.cardIds.map(renderPlanCard)}
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
          </motion.div>

          {/* Each group is a row of its own, with a title and notes
              (docs/plans.md § "Groups"). */}
          {picks.groups.map((group, index) => {
            const name = group.title.trim() || `Group ${index + 1}`
            return (
              <section className="plan-group" key={group.id} data-group-id={group.id} aria-label={name}>
                {/* Beside the cards on a wide screen, above them otherwise
                    (docs/plans.md § "Groups"). */}
                <div className="plan-group-info">
                  <input
                    className="plan-group-title"
                    type="text"
                    aria-label={`Title of ${name}`}
                    placeholder={`Group ${index + 1}`}
                    maxLength={80}
                    value={group.title}
                    onChange={(event) =>
                      setPicks((current) => changeGroup(current, group.id, { title: event.target.value }))
                    }
                  />
                  <textarea
                    className="plan-group-notes"
                    aria-label={`Notes on ${name}`}
                    placeholder="Notes"
                    rows={1}
                    maxLength={2000}
                    value={group.notes}
                    onChange={(event) =>
                      setPicks((current) => changeGroup(current, group.id, { notes: event.target.value }))
                    }
                  />
                  <button
                    className="text-action plan-group-remove"
                    type="button"
                    aria-label={`Remove ${name}`}
                    onClick={() => setPicks((current) => removeGroup(current, group.id))}
                  >
                    Remove group
                  </button>
                </div>
                <motion.div className="plan-track plan-group-track" data-plan-row={group.id} layoutScroll>
                  {group.cardIds.map(renderPlanCard)}
                  {group.cardIds.length === 0 && (
                    <motion.div className="empty-slot group-slot" layout transition={transition}>
                      <span>Drag ideas here</span>
                    </motion.div>
                  )}
                </motion.div>
              </section>
            )
          })}

          <div className="plan-group-add">
            <button className="text-action" type="button" onClick={newGroup}>
              Add group
            </button>
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

      {drag.lifted && liftedCard && (
        <DragStandIn lifted={drag.lifted} motionValues={drag.standIn}>
          <Card card={liftedCard} frame={frameFor(liftedCard.id)} scrawl={notesById.get(liftedCard.id)} />
        </DragStandIn>
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
