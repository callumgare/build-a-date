import { drawnCards, type PreviewInput } from './preview'

// Which picture a deck or plan should have (docs/share-previews.md § "When
// it's drawn"). The server works it out from the database, the browser from
// what it's drawing, and a picture is only kept when the two agree. Cards off
// the edge of the picture don't count, so a big deck isn't redrawn for them.

/** Bump this whenever the picture is drawn differently, so every one is drawn again. */
export const DRAWING_VERSION = 1

export function previewKey(input: PreviewInput) {
  const cards = drawnCards(input).map((card) => [card.id, card.title, card.date ?? null])
  return hash(JSON.stringify([DRAWING_VERSION, input.layout, input.title, cards]))
}

// cyrb53: a quick 53-bit hash, plenty to tell one picture from another.
function hash(text: string) {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index)
    h1 = Math.imul(h1 ^ code, 2654435761)
    h2 = Math.imul(h2 ^ code, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}
