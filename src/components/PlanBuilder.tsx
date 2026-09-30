'use client'

import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react'
import { nanoid } from 'nanoid'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { deletePlan, savePlan, updatePlan } from '@/lib/actions/plans'
import { saveDeckSort } from '@/lib/actions/preferences'
import { arrangeDeck, type DeckSort, keepArrangement, sortDeck } from '@/lib/deck-order'
import type { AccessState } from '@/lib/decks'
import { drawPreview, preloadPreview } from '@/lib/og/client'
import {
  addCard,
  addGroup,
  changeGroup,
  firstRow,
  keepCards,
  noPicks,
  pickedIds,
  picksKey,
  placeCard,
  removeCard as removeFromPicks,
  removeGroup,
  stepCard,
} from '@/lib/plan-picks'
import type { SentPreview } from '@/lib/previews'
import type { DateCard, PlanPicks } from '@/types'
import BuilderBar, { SampleSave } from './builder/BuilderBar'
import BuilderColumn from './builder/BuilderColumn'
import DeckFilters from './builder/DeckFilters'
import Card from './Card'
import cardStyles from './Card.module.css'
import CardGrid from './CardGrid'
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
import { useGridShuffle } from './gridShuffle'
import InstallHint from './InstallHint'
import { readPicks, writePicks } from './keptPicks'
import PageShell from './PageShell'
import { PlanActions } from './PlanBar'
import styles from './PlanBuilder.module.css'
import { DragStandIn, PlanCard, usePlanDrag } from './PlanCard'
import { groupTrack, PlanGroupEditor } from './PlanGroup'
import SharePreviewRefresher, { type PreviewProps } from './SharePreviewRefresher'
import SiteFooter from './SiteFooter'
import { shrinkOf, switchOver } from './shrink'
import type { Box } from './tilt'
import Button from './ui/Button'
import EmptyResults from './ui/EmptyResults'
import EmptySlot from './ui/EmptySlot'
import Hero, { Lede } from './ui/Hero'
import Muted from './ui/Muted'

type PlanBuilderProps = {
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
  // Every idea picked into one of the deck's saved plans, which the Not in
  // plan filter hides (docs/deck-filters.md § "Not in plan"). Nothing is
  // passed when no plan has been saved, which leaves the filter out.
  plannedCardIds?: string[]
  // The sample deck, which isn't saved anywhere, so it can't save a plan or
  // notes (docs/sample-deck.md).
  sample?: boolean
  // For owners and editors, who keep the deck's link preview up to date
  // (docs/share-previews.md § "When it's drawn").
  preview?: PreviewProps
}

export default function PlanBuilder({
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
  plannedCardIds = [],
  sample = false,
  preview,
}: PlanBuilderProps) {
  const [arranged, setArranged] = useState(() => arrangeDeck(deckCards, seed))
  const [arrangedFrom, setArrangedFrom] = useState(deckCards)
  // The picks, row by row in the plan's order. The server can't see what
  // this browser kept, so they start as the saved plan, or empty, and what was
  // kept is read in before the first paint.
  const [picks, setPicks] = useState<PlanPicks>(() => (plan ? { cardIds: plan.cardIds, groups: plan.groups } : noPicks))
  const selectedIds = useMemo(() => pickedIds(picks), [picks])
  const hasPicks = selectedIds.length > 0
  // Once there's something to save, start loading what drawing the plan's
  // link preview needs, so Save plan isn't kept waiting for it.
  useEffect(() => {
    if (hasPicks && !sample) preloadPreview()
  }, [hasPicks, sample])
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
  // afresh rather than flying them over from the deck.
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
  // The Not in plan filter, which hides the ideas a saved plan has already
  // used (docs/deck-filters.md § "Not in plan").
  const [notInPlan, setNotInPlan] = useState(false)
  // Cards flying from the deck into the plan, or back (docs/card-layout.md
  // § "Flying cards"), at most one flight for each card.
  const [flights, setFlights] = useState<Flight[]>([])
  const flyingIds = useMemo(() => new Set(flights.map((each) => each.id)), [flights])
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
  // The part of the plan's column that scrolls up and down on its own, under
  // its title, and the deck's column.
  const planReference = useRef<HTMLDivElement>(null)
  const deckReference = useRef<HTMLDivElement>(null)
  // On a narrow screen only one column is in use, and the other is shrunk
  // until it's clicked (docs/card-layout.md § "Narrow screens").
  const narrow = useNarrowScreen()
  // On a wide screen, both are in use, and this is the one last pressed or
  // focused in, which stays in use if the screen narrows. The deck until
  // then.
  const [active, setActive] = useState<Column>('deck')
  const planShrunk = narrow && active !== 'plan'
  const deckShrunk = narrow && active !== 'deck'
  // How far down the deck, in its own units, the top of the window was when
  // it was last in use, to keep there as it shrinks and to go back to when
  // it's in use again.
  const deckAnchor = useRef<number | null>(null)
  // The card moved from the keyboard, whose grip gets focus back afterwards.
  const [movedId, setMovedId] = useState<string | null>(null)
  // A group just added, whose title gets focus.
  const [addedGroupId, setAddedGroupId] = useState<string | null>(null)
  const reduceMotion = useReducedMotion()
  // The builder, whose grids shuffle into their new places when they gain or
  // lose a column.
  const builderReference = useRef<HTMLDivElement>(null)
  // A column grows or shrinks when the one in use changes on a narrow screen,
  // and when the window crosses into or out of being narrow. Meanwhile the
  // grids keep their columns, and shuffle to their new ones once it's done
  // (docs/card-layout.md § "Shuffling to a new number of columns").
  useGridShuffle(builderReference, {
    disabled: Boolean(reduceMotion),
    holdKey: `${narrow}-${narrow ? active : ''}`,
    holdUntil: switchOver,
  })
  const drag = usePlanDrag({
    container: planReference,
    onMove: (id, place) => setPicks((current) => placeCard(current, id, place.row, place.index)),
    reduceMotion: Boolean(reduceMotion),
  })
  const router = useRouter()

  const tags = useMemo(() => [...new Set(deckCards.flatMap((card) => card.tags))].sort(), [deckCards])
  const cardEditor = useCardEditor(deckId, tags)
  // The ideas some saved plan has already used, as a set, for the Not in plan
  // filter. Empty until the deck has a saved plan, which leaves the filter
  // out (docs/deck-filters.md § "Not in plan").
  const inSavedPlans = useMemo(() => new Set(plannedCardIds), [plannedCardIds])

  const availableCards = cards.filter(
    (card) =>
      !selectedIds.includes(card.id) &&
      [...activeTags].every((tag) => card.tags.includes(tag)) &&
      (!notInPlan || !inSavedPlans.has(card.id)),
  )

  // Each column's height at full size, which a shrunk one takes back most of
  // with its bottom margin, as its scale doesn't make it take up any less
  // room (PlanBuilder.module.css, --layout-height; docs/card-layout.md § "Narrow
  // screens"). Before the browser paints, and again whenever the builder is
  // laid out afresh for kept picks, which replaces it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the builder is replaced when layoutGeneration changes
  useLayoutEffect(() => {
    const builder = builderReference.current
    if (!builder) return
    const sections = [...builder.querySelectorAll<HTMLElement>('[data-shrinks]')]
    function measure() {
      for (const section of sections) section.style.setProperty('--layout-height', `${section.offsetHeight}px`)
    }
    measure()
    const observer = new ResizeObserver(measure)
    for (const section of sections) observer.observe(section)
    return () => observer.disconnect()
  }, [layoutGeneration])

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
    if (!reduceMotion) fly([{ id, from, to: 'plan' }])
    setPicks((current) => addCard(current, id))
  }

  // Picks from the ideas the current filters show, flying it over from its
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

  // Starts these flights, in place of any the same cards were already on.
  function fly(started: Flight[]) {
    const ids = new Set(started.map((each) => each.id))
    setFlights((current) => [...current.filter((each) => !ids.has(each.id)), ...started])
  }

  // Flights back into the deck, from where these cards are in the plan.
  function flightsHome(ids: string[]): Flight[] {
    if (reduceMotion) return []
    return ids.flatMap((id) => {
      const planCard = document.querySelector(`[data-card-id="${CSS.escape(id)}"]`)
      return planCard ? [{ id, from: cardBox(planCard), to: 'deck' as const }] : []
    })
  }

  // Back into the deck, flying there from its place in the plan.
  function removeCard(id: string) {
    fly(flightsHome([id]))
    setPicks((current) => removeFromPicks(current, id))
  }

  // Every card back into the deck, all flying there at once
  // (docs/card-layout.md § "Flying cards").
  function clearPlan() {
    fly(flightsHome(selectedIds))
    setPicks(noPicks)
  }

  // Moves a card one place up or down the plan, from its grip with the arrow
  // keys (docs/card-layout.md § "Reordering the plan").
  function moveCard(id: string, by: -1 | 1) {
    setPicks((current) => stepCard(current, id, by))
    setMovedId(id)
  }

  // How much room the plan's column keeps for its scrollbar, on each side,
  // which the shrunk plan makes up with padding (PlanBuilder.module.css,
  // .builder[data-active='deck'] .planSection). It depends on the browser
  // and system, so it's measured on a stand-in with the same scrollbar. The
  // root layout has already measured it before the page was first drawn
  // (measureScrollbarGutter in src/app/layout.tsx); this sets it on the
  // builder too, and again whenever the builder is laid out afresh for kept
  // picks, which replaces it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the builder is replaced when layoutGeneration changes
  useLayoutEffect(() => {
    const builder = builderReference.current
    if (!builder) return
    const probe = document.createElement('div')
    Object.assign(probe.style, {
      position: 'absolute',
      visibility: 'hidden',
      width: '100px',
      height: '10px',
      overflowY: 'auto',
      scrollbarGutter: 'stable both-edges',
      scrollbarWidth: 'thin',
    })
    builder.appendChild(probe)
    builder.style.setProperty('--scrollbar-gutter', `${(probe.offsetWidth - probe.clientWidth) / 2}px`)
    probe.remove()
  }, [layoutGeneration])

  // Marks the builder while a column grows or shrinks on a narrow screen
  // (PlanBuilder.module.css, .builder[data-switching]). Not when the page first opens.
  const switchedOnce = useRef(false)
  // biome-ignore lint/correctness/useExhaustiveDependencies: only when the column in use changes
  useLayoutEffect(() => {
    const builder = builderReference.current
    if (!narrow || !builder || !switchedOnce.current) {
      switchedOnce.current = true
      return
    }
    builder.dataset.switching = ''
    let current = true
    switchOver(builder).then(() => {
      if (current) delete builder.dataset.switching
    })
    return () => {
      current = false
      delete builder.dataset.switching
    }
  }, [active])

  // Marks which ends of the plan are scrolled out of sight, which fade out
  // rather than being cut off (docs/card-layout.md § "The plan column" -
  // fading out). Again whenever the plan is laid out afresh for kept picks,
  // which replaces the element that scrolls.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the plan is replaced when layoutGeneration changes
  useEffect(() => {
    const scroller = planReference.current
    if (!scroller) return
    const plan = scroller
    function mark() {
      plan.toggleAttribute('data-more-above', plan.scrollTop > 1)
      plan.toggleAttribute('data-more-below', plan.scrollTop + plan.clientHeight < plan.scrollHeight - 1)
    }
    mark()
    plan.addEventListener('scroll', mark, { passive: true })
    const observer = new ResizeObserver(mark)
    observer.observe(plan)
    if (plan.firstElementChild) observer.observe(plan.firstElementChild)
    return () => {
      plan.removeEventListener('scroll', mark)
      observer.disconnect()
    }
  }, [layoutGeneration])

  // Where the top of the deck is on the page.
  function deckTop() {
    return (deckReference.current?.getBoundingClientRect().top ?? 0) + window.scrollY
  }

  function activate(column: Column) {
    if (column === 'plan') deckAnchor.current = window.scrollY > deckTop() ? window.scrollY - deckTop() : null
    setActive(column)
  }

  // Anything pressed or focused in a column on a wide screen (docs/card-layout.md
  // § "Narrow screens" - the last column used). On a narrow screen only the
  // switch over a shrunk column changes it.
  function used(column: Column) {
    if (narrow) return
    deckAnchor.current = null
    setActive(column)
  }

  // As the deck shrinks, or grows back, the part of it at the top of the
  // window stays there, so the page doesn't scroll under it as it gets
  // shorter or longer: while it shrinks, cards would come sliding down from
  // the top, and it comes back to the same place (docs/card-layout.md
  // § "Narrow screens" - back to the same place). Scrolled each frame, by
  // how much the deck is shrunk at that moment, until the switch is over.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only when the column in use changes
  useLayoutEffect(() => {
    const anchor = deckAnchor.current
    const section = deckReference.current?.querySelector('[data-shrinks]')
    if (!narrow || anchor === null || !section) return
    if (active === 'deck') deckAnchor.current = null
    const offset = anchor
    function keep() {
      window.scrollTo(0, deckTop() + offset * shrinkOf(section as Element))
    }
    keep()
    let over = false
    const builder = builderReference.current
    if (builder) switchOver(builder).then(() => (over = true))
    else over = true
    let frame = requestAnimationFrame(function follow() {
      keep()
      if (!over) frame = requestAnimationFrame(follow)
    })
    return () => cancelAnimationFrame(frame)
  }, [active])

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

  // All clears every filter, Not in plan among them. It in turn turns All
  // off, but leaves the tag filters as they were: it rules out All, not the
  // tags (docs/deck-filters.md § "Not in plan").
  function clearFilters() {
    setActiveTags(new Set())
    setNotInPlan(false)
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
  // again if nothing has changed. Its link was already shared, so its page
  // opens without the dialog (docs/plans.md § "Editing a plan").
  async function sharePlan() {
    const key = picksKey(picks)
    let planId = saved?.key === key ? saved.planId : null
    setSaveError(null)

    if (!planId) {
      setSaving(true)
      try {
        const preview = await drawPlanPreview()
        const result = plan
          ? await updatePlan(plan.id, picks.cardIds, picks.groups, preview)
          : await savePlan(shareId, picks.cardIds, picks.groups, preview)
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
    router.push(plan ? `/p/${planId}` : `/p/${planId}?share`)
  }

  // The plan's link preview, drawn from the picks and sent with the save, so
  // it's ready when the link is shared (docs/share-previews.md § "When it's
  // drawn"). If it can't be drawn in time, the plan saves without it and its
  // page draws one.
  async function drawPlanPreview(): Promise<SentPreview | undefined> {
    const byId = new Map(deckCards.map((card) => [card.id, card]))
    const cards = selectedIds.flatMap((id) => {
      const card = byId.get(id)
      if (!card) return []
      return card.date ? { id, title: card.title, date: card.date } : { id, title: card.title }
    })
    try {
      return await drawPreview({ title: deckName, cards, layout: 'fan' })
    } catch (error) {
      console.warn("Couldn't draw the plan's link preview", error)
      return undefined
    }
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
  // Things still slide into their new places in a shrunk column, with each
  // slide scaled up to match how much the column is shrunk
  // (docs/card-layout.md § "Narrow screens").
  const planMotion = { transition, transformTemplate: planShrunk ? unshrinkSlide : undefined }
  const deckMotion = { transition, transformTemplate: deckShrunk ? unshrinkSlide : undefined }
  const endFlight = useCallback((id: string) => setFlights((current) => current.filter((each) => each.id !== id)), [])
  const showActions = Boolean(plan) || selectedIds.length > 0 || picks.groups.length > 0
  // The first card picked, still flying onto the slot.
  const coveringSlot =
    selectedIds.length === 1 && flights.some((each) => each.to === 'plan' && each.id === selectedIds[0])
  const notesCard = notesOpen && cardsById.get(notesOpen.id)
  const liftedCard = drag.lifted && cardsById.get(drag.lifted.id)

  function renderPlanCard(id: string) {
    const card = cardsById.get(id)
    if (!card) return null
    const actions: SideActions = { primary: () => removeCard(card.id), notes: () => openNotes(card.id) }

    return (
      <PlanCard
        className={`${cardStyles.card} ${flyingIds.has(card.id) || notesOpen?.id === card.id ? cardStyles.inFlight : ''}`}
        key={card.id}
        title={card.title}
        lifted={drag.liftedId === card.id}
        data-card-id={card.id}
        data-revealed={revealedId === card.id}
        onPointerEnter={tiltCard}
        {...planMotion}
        onClick={(event) => clickCard(card.id, event, actions)}
        onPointerMove={showHoveredSide}
        onPointerLeave={leaveCard}
        onPress={(event) => drag.pressCard(event, card.id)}
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
  }

  return (
    <PageShell>
      <InstallHint />
      {preview && <SharePreviewRefresher {...preview} />}

      <Hero title={deckName}>
        {plan && <Lede>Editing a plan</Lede>}
        {sample && <Lede>A sample deck to try out. Pick the ideas you like best to make a plan.</Lede>}
      </Hero>

      {/* A new group for kept picks, so the cards that were in the deck have
          nothing to fly in from. */}
      <LayoutGroup id={`date-builder-${layoutGeneration}`} key={layoutGeneration}>
        {/* The deck on the left, and the plan in a column on the right, running
            down (docs/card-layout.md § "The plan column"). */}
        <div className={styles.builder} data-builder data-active={active} ref={builderReference}>
          {/* Until there's a plan to act on, it says how to start one. While
              editing a plan the buttons always show, so Cancel is there even
              once it's emptied (docs/plans.md § "Editing a plan"). */}
          <BuilderBar
            className={styles.bar}
            showActions={showActions}
            reduceMotion={Boolean(reduceMotion)}
            error={saveError}
          >
            <PlanActions>
              {sample ? (
                <SampleSave>
                  <Muted>To save a plan</Muted>
                  <Button href="/sign-up">Create your own deck</Button>
                </SampleSave>
              ) : (
                <Button onClick={sharePlan} disabled={saving || deleting || selectedIds.length === 0}>
                  {saving ? 'Saving…' : plan ? 'Update Plan' : 'Save plan'}
                </Button>
              )}
              {plan && (
                // Unsaved changes are dropped, so the edit page starts from the
                // saved plan next time.
                <Button variant="text" href={`/p/${plan.id}`} onClick={() => writePicks(picksPlace, null)}>
                  Cancel
                </Button>
              )}
              {plan ? (
                <Button variant="text" onClick={removePlan} disabled={saving || deleting}>
                  {deleting ? 'Deleting…' : 'Delete plan'}
                </Button>
              ) : (
                <Button variant="text" onClick={clearPlan}>
                  Clear plan
                </Button>
              )}
            </PlanActions>
          </BuilderBar>

          <BuilderColumn
            column="deck"
            className={styles.deckColumn}
            shrunk={deckShrunk}
            ref={deckReference}
            onUse={() => used('deck')}
            switchLabel="Show the date ideas"
            onSwitch={() => activate('deck')}
          >
            <section className={styles.deckSection} data-shrinks aria-label="Date ideas" inert={deckShrunk}>
              <DeckFilters
                tags={tags}
                activeTags={activeTags}
                // Only once a plan has been saved is there anything for the
                // filter to hide (docs/deck-filters.md § "Not in plan").
                notInPlan={inSavedPlans.size > 0 ? notInPlan : undefined}
                onShowAll={clearFilters}
                onToggleTag={toggleTag}
                onToggleNotInPlan={() => setNotInPlan((on) => !on)}
                sort={sort}
                onSort={chooseSort}
              />

              <CardGrid layout {...deckMotion}>
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
                        className={`${cardStyles.card} ${flyingIds.has(card.id) || notesOpen?.id === card.id ? cardStyles.inFlight : ''}`}
                        key={card.id}
                        data-deck-card-id={card.id}
                        data-revealed={revealedId === card.id}
                        layout
                        onPointerEnter={tiltCard}
                        initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        // Only a fade: the hover's spring back animates scale
                        // too, and would stop a shrink from ever finishing
                        // (docs/card-layout.md § "Flying cards").
                        exit={reduceMotion ? undefined : { opacity: 0 }}
                        {...deckMotion}
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
                  <motion.div layout {...deckMotion}>
                    <AddCardControls onAdd={cardEditor.addCard} onQuickAdd={cardEditor.quickAdd} />
                  </motion.div>
                )}
              </CardGrid>

              {availableCards.length === 0 && (
                <EmptyResults message="No ideas match the filters.">
                  <Button variant="text" onClick={clearFilters}>
                    Show all ideas
                  </Button>
                </EmptyResults>
              )}
            </section>
          </BuilderColumn>

          <BuilderColumn
            column="plan"
            className={styles.planColumn}
            shrunk={planShrunk}
            onUse={() => used('plan')}
            switchLabel="Show your plan"
            onSwitch={() => activate('plan')}
          >
            {/* Above the plan, not scrolling with it (docs/card-layout.md
                § "The plan column" - the title). */}
            <h2 className={styles.planHeading} data-shrinks>
              The Plan
            </h2>
            <div
              className={styles.planScroll}
              data-plan-scroll
              ref={planReference}
              data-dragging={drag.lifted ? true : undefined}
            >
              <section className={styles.planSection} data-shrinks aria-label="Your plan" inert={planShrunk}>
                {/* Cards in the plan are dragged to reorder it, or onto another
                    row (docs/card-layout.md § "Reordering the plan"). */}
                <CardGrid
                  stacked
                  data-plan-row={firstRow}
                  aria-label={picks.groups.length > 0 ? 'Not in a group' : undefined}
                  role={picks.groups.length > 0 ? 'group' : undefined}
                  layoutScroll
                >
                  {/* No AnimatePresence: a card moved to another row would linger
                      here as it left, and nothing in the plan has an exit animation.
                      A discarded card flies back to the deck as a FlyingCard. */}
                  {/* The first card picked lands on the blank slot and covers it:
                      the slot stays under it, where it was, until the card has
                      flown there (docs/card-layout.md § "The plan column" - the
                      slot). First, so the card is drawn over it. */}
                  {coveringSlot && <EmptySlot className={styles.coveredSlot} data-covered="true" aria-hidden="true" />}
                  {picks.cardIds.map(renderPlanCard)}
                  {/* A blank card-sized slot until something's picked, and a way to
                      draw a card at random (docs/card-layout.md § "The plan
                      column"). */}
                  {selectedIds.length === 0 && <EmptySlot aria-hidden="true" layout {...planMotion} />}
                  {availableCards.length > 0 && (
                    // Slides down out of the way of a card coming in, rather than
                    // jumping (docs/card-layout.md § "The plan column").
                    <motion.div
                      className={styles.randomPick}
                      data-random-pick
                      data-full-width
                      layout="position"
                      {...planMotion}
                    >
                      <Button variant="text" onClick={selectRandomCard}>
                        Draw random card
                      </Button>
                    </motion.div>
                  )}
                </CardGrid>

                {/* Each group is a row of its own, with a title and notes
                    (docs/plans.md § "Groups"). */}
                {picks.groups.map((group, index) => {
                  const name = group.title.trim() || `Group ${index + 1}`
                  return (
                    // Slides as the rows above it grow or shrink. Only its place
                    // animates, not its size, which would stretch its fields.
                    <PlanGroupEditor
                      key={group.id}
                      id={group.id}
                      name={name}
                      placeholder={`Group ${index + 1}`}
                      title={group.title}
                      notes={group.notes}
                      onChange={(change) => setPicks((current) => changeGroup(current, group.id, change))}
                      onRemove={() => setPicks((current) => removeGroup(current, group.id))}
                      layout="position"
                      {...planMotion}
                    >
                      <CardGrid stacked className={groupTrack} data-plan-row={group.id} layoutScroll>
                        {group.cardIds.map(renderPlanCard)}
                        {group.cardIds.length === 0 && (
                          <EmptySlot compact data-full-width layout {...planMotion}>
                            <span>Drag ideas here</span>
                          </EmptySlot>
                        )}
                      </CardGrid>
                    </PlanGroupEditor>
                  )
                })}

                <motion.div className={styles.groupAdd} data-group-add layout="position" {...planMotion}>
                  <Button variant="text" onClick={newGroup}>
                    Add group
                  </Button>
                </motion.div>
              </section>
            </div>
          </BuilderColumn>
        </div>
      </LayoutGroup>

      {plans && (
        <section aria-label="Plans">
          <PlanList plans={plans} />
        </section>
      )}

      {flights.map((flight) => {
        const flyingCard = cardsById.get(flight.id)
        return (
          flyingCard && (
            <FlyingCard
              key={flight.id}
              card={flyingCard}
              frame={frameFor(flyingCard.id)}
              scrawl={notesById.get(flyingCard.id)}
              from={flight.from}
              into={flight.to === 'plan' ? planReference : deckReference}
              slot={flight.to === 'plan' ? 'data-card-id' : 'data-deck-card-id'}
              transition={transition}
              onDone={endFlight}
            />
          )
        )
      })}

      {drag.lifted && liftedCard && (
        <DragStandIn lifted={drag.lifted} motionValues={drag.standIn}>
          <Card
            card={liftedCard}
            frame={frameFor(liftedCard.id)}
            actions={
              <CardActions
                title={liftedCard.title}
                primary="Discard"
                actions={{ primary: () => removeCard(liftedCard.id), notes: () => openNotes(liftedCard.id) }}
              />
            }
            scrawl={notesById.get(liftedCard.id)}
          />
          {deckId && <EditButton title={liftedCard.title} onClick={() => editCard(liftedCard)} />}
        </DragStandIn>
      )}

      {notesOpen && notesCard && (
        <CardNotes
          key={notesOpen.id}
          card={notesCard}
          frame={frameFor(notesCard.id)}
          shareId={sample ? undefined : shareId}
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

      <SiteFooter>
        {sample ? null : editHref ? (
          <Button variant="text" href={editHref}>
            Edit this deck
          </Button>
        ) : access === 'pending' ? (
          <Muted>You&apos;ve asked to edit this deck</Muted>
        ) : (
          <Button variant="text" href={`/d/${shareId}/request`}>
            Request edit access
          </Button>
        )}
      </SiteFooter>
    </PageShell>
  )
}

type Column = 'plan' | 'deck'

// A card flying from the deck into the plan, or back into the deck.
type Flight = { id: string; from: Box; to: Column }

// How much a column is shrunk while it isn't in use on a narrow screen. The
// same as --shrink in PlanBuilder.module.css.
const shrunkScale = 0.2

// Motion works out a slide in the screen's pixels, but it's drawn inside the
// shrunk column, where each pixel is a fifth of the size, so the slide would
// start only a fifth of the way back. This scales it up to match. A change of
// size is a ratio, the same either way, so only the move needs it.
function unshrinkSlide(_: unknown, generated: string) {
  return generated.replace(
    /translate3d\((-?[\d.]+)px, (-?[\d.]+)px, (-?[\d.]+)px\)/,
    (_match, x: string, y: string, z: string) =>
      `translate3d(${Number(x) / shrunkScale}px, ${Number(y) / shrunkScale}px, ${z}px)`,
  )
}

// Below this width only one column is in use at a time. The same width as the
// media query in PlanBuilder.module.css.
const narrowScreen = '(max-width: 899px)'

function useNarrowScreen() {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(narrowScreen)
      query.addEventListener?.('change', onChange)
      return () => query.removeEventListener?.('change', onChange)
    },
    () => window.matchMedia(narrowScreen).matches,
    () => false,
  )
}
