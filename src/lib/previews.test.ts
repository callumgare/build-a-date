import { previewKey } from '@/lib/og/preview-key'
import { createTestDb, createUser } from '@/test/db'
import { fakeJpeg, fakeJpegBlob } from '@/test/jpeg'
import * as decks from './decks'
import {
  deckPreviewInput,
  getPreviewImage,
  getPreviewKey,
  keepPreview,
  PreviewRejected,
  planPreviewInput,
  previewState,
  savePreview,
} from './previews'

let db: ReturnType<typeof createTestDb>
let deck: Awaited<ReturnType<typeof decks.createDeck>>
let ids: Record<string, string>

beforeEach(async () => {
  db = createTestDb()
  await createUser(db, 'owner')
  deck = await decks.createDeck(db, 'owner', { name: 'Weekend', template: 'empty' })
  ids = {}
  for (const [title, date] of [
    ['Picnic', undefined],
    ['Hike', 'Sun 5 Oct'],
    ['Gig', undefined],
  ] as const) {
    ids[title] = (await decks.saveCard(db, 'owner', deck.id, null, { title, date })).id
  }
})

async function deckInput() {
  return deckPreviewInput(deck, (await decks.getSharedDeck(db, deck.shareId)).cards)
}

/** @see docs/share-previews.md § "A deck" */
it("draws a deck as a grid of its cards, in the deck's order, with only what the picture shows", async () => {
  expect(await deckInput()).toEqual({
    title: 'Weekend',
    layout: 'grid',
    cards: [
      { id: ids.Picnic, title: 'Picnic' },
      { id: ids.Hike, title: 'Hike', date: 'Sun 5 Oct' },
      { id: ids.Gig, title: 'Gig' },
    ],
  })
})

/** @see docs/share-previews.md § "A plan" */
it("fans out a plan's picks in plan order: the first row, then each group's", async () => {
  const plan = await decks.savePlan(
    db,
    deck.shareId,
    [ids.Hike],
    [{ id: 'later', title: 'Later', notes: '', cardIds: [ids.Gig, ids.Picnic] }],
  )
  const input = planPreviewInput(await decks.getPlan(db, plan.id))
  expect(input).toMatchObject({ title: 'Weekend', layout: 'fan' })
  expect(input.cards.map((card) => card.title)).toEqual(['Hike', 'Gig', 'Picnic'])
})

/** @see docs/share-previews.md § "Storing and serving" */
describe('storing a picture', () => {
  it('keeps one picture per deck and per plan, replacing the last', async () => {
    const plan = await decks.savePlan(db, deck.shareId, [ids.Hike])
    expect(await getPreviewKey(db, 'deck', deck.id)).toBeNull()

    await savePreview(db, 'deck', deck.id, 'first', fakeJpeg())
    await savePreview(db, 'deck', deck.id, 'second', fakeJpeg({ padding: 3 }))
    await savePreview(db, 'plan', plan.id, 'plan', fakeJpeg())

    expect(await getPreviewKey(db, 'deck', deck.id)).toBe('second')
    const stored = await getPreviewImage(db, 'deck', deck.id)
    expect(stored?.key).toBe('second')
    expect(new Uint8Array(stored?.image ?? [])).toEqual(fakeJpeg({ padding: 3 }))
    expect(await getPreviewKey(db, 'plan', plan.id)).toBe('plan')
  })

  it('goes with its deck or plan when that is deleted', async () => {
    const plan = await decks.savePlan(db, deck.shareId, [ids.Hike])
    await savePreview(db, 'plan', plan.id, 'plan', fakeJpeg())
    await decks.deletePlan(db, plan.id)
    expect(await getPreviewImage(db, 'plan', plan.id)).toBeNull()

    await savePreview(db, 'deck', deck.id, 'deck', fakeJpeg())
    await decks.deleteDeck(db, 'owner', deck.id)
    expect(await getPreviewImage(db, 'deck', deck.id)).toBeNull()
  })

  it("tells when the picture kept isn't of what the deck shows now", async () => {
    const input = await deckInput()
    expect(await previewState(db, 'deck', deck.id, input)).toMatchObject({ stored: null, stale: true })
    await savePreview(db, 'deck', deck.id, previewKey(input), fakeJpeg())
    expect(await previewState(db, 'deck', deck.id, input)).toMatchObject({ stale: false })
    await decks.renameDeck(db, 'owner', deck.id, 'Weekends')
    deck = { ...deck, name: 'Weekends' }
    expect(await previewState(db, 'deck', deck.id, await deckInput())).toMatchObject({ stale: true })
  })
})

/** @see docs/share-previews.md § "Who can upload a picture" */
describe('keepPreview', () => {
  it('keeps a 1200×630 JPEG of what the deck shows now', async () => {
    const input = await deckInput()
    await keepPreview(db, 'deck', deck.id, input, { key: previewKey(input), image: fakeJpegBlob() })
    expect(await getPreviewKey(db, 'deck', deck.id)).toBe(previewKey(input))
  })

  it('refuses a picture of something else, or that isn’t a 1200×630 JPEG, and keeps nothing', async () => {
    const input = await deckInput()
    const key = previewKey(input)
    const refused = [
      { key: 'out-of-date', image: fakeJpegBlob() },
      { key, image: fakeJpegBlob({ width: 800, height: 600 }) },
      { key, image: new Blob(['<svg/>']) },
      { key, image: 'not a blob' as unknown as Blob },
    ]
    for (const sent of refused) {
      await expect(keepPreview(db, 'deck', deck.id, input, sent)).rejects.toThrow(PreviewRejected)
    }
    expect(await getPreviewKey(db, 'deck', deck.id)).toBeNull()
  })
})
