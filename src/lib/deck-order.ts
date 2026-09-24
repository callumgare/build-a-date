import { type Frame, frameFor } from '@/components/frames'
import type { DateCard } from '@/types'

// A small seeded PRNG (mulberry32), so the server and the browser shuffle a
// deck into the same order and hydration matches.
function random(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

// The page picks a fresh seed on every load, so each visit gets a new order.
export function shuffle<T>(items: T[], seed: number): T[] {
  const next = random(seed)
  const shuffled = [...items]
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swap = Math.floor(next() * (index + 1))
    ;[shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]]
  }
  return shuffled
}

// Keeps matching frames apart: each card takes the next in the shuffle whose
// frame isn't among the last few placed, so neither the card beside it nor
// the one above it (the grid runs up to six columns) shares its frame. A
// frame with too many cards left to stay spread out goes first, so they
// don't bunch up at the end, and when no card fits, the gap shrinks.
export function spreadFrames(shuffled: DateCard[]): DateCard[] {
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

export function arrangeDeck(cards: DateCard[], seed: number) {
  return spreadFrames(shuffle(cards, seed))
}
