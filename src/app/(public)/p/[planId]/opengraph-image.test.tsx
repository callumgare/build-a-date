import * as decks from '@/lib/decks'
import { renderShareImage } from '@/lib/og/render'
import { useTestDb } from '@/test/cloudflare'
import { createTestDb, createUser } from '@/test/db'
import { NotFoundPage } from '@/test/next'
import { pngSize } from '@/test/png'
import Image from './opengraph-image'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => import('@/test/next'))
vi.mock('@opennextjs/cloudflare', () => import('@/test/cloudflare'))
vi.mock('@/db', () => import('@/test/cloudflare'))
vi.mock('@/lib/og/render', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/og/render')>()
  return { ...original, renderShareImage: vi.fn(original.renderShareImage) }
})

let db: ReturnType<typeof createTestDb>
let deck: Awaited<ReturnType<typeof decks.createDeck>>
let cards: Record<string, string>

function image(planId: string) {
  return Image({ params: Promise.resolve({ planId }) })
}

beforeEach(async () => {
  db = createTestDb()
  useTestDb(db)
  await createUser(db, 'owner')
  deck = await decks.createDeck(db, 'owner', { name: 'Weekend', template: 'empty' })
  cards = {}
  for (const title of ['Picnic', 'Hike', 'Karaoke', 'Museum']) {
    cards[title] = (await decks.saveCard(db, 'owner', deck.id, null, { title })).id
  }
  vi.mocked(renderShareImage).mockClear()
})

/** @see docs/share-previews.md § "A plan" */
describe("a plan's link preview", () => {
  it('is a 1200×630 PNG', async () => {
    const plan = await decks.savePlan(db, deck.shareId, [cards.Hike, cards.Picnic])
    const response = await image(plan.id)
    expect(response.headers.get('content-type')).toBe('image/png')
    expect(await pngSize(response)).toEqual({ width: 1200, height: 630 })
  })

  it("fans out every pick in plan order, the first row and then each group's", async () => {
    const plan = await decks.savePlan(
      db,
      deck.shareId,
      [cards.Hike],
      [
        { id: 'evening', title: 'Evening', notes: '', cardIds: [cards.Karaoke, cards.Picnic] },
        { id: 'sunday', title: 'Sunday', notes: '', cardIds: [cards.Museum] },
      ],
    )
    await image(plan.id)
    expect(renderShareImage).toHaveBeenCalledWith(expect.objectContaining({ title: 'Weekend', layout: 'fan' }))
    const [{ cards: drawn }] = vi.mocked(renderShareImage).mock.calls[0]
    expect(drawn.map((card) => card.title)).toEqual(['Hike', 'Karaoke', 'Picnic', 'Museum'])
  })

  it('shows just the name once all its cards are gone from the deck', async () => {
    const plan = await decks.savePlan(db, deck.shareId, [cards.Hike])
    await decks.deleteCard(db, 'owner', deck.id, cards.Hike)
    const response = await image(plan.id)
    expect(vi.mocked(renderShareImage).mock.calls[0][0].cards).toEqual([])
    expect(await pngSize(response)).toEqual({ width: 1200, height: 630 })
  })

  it("is not found for a plan that doesn't exist", async () => {
    await expect(image('nope')).rejects.toThrow(NotFoundPage)
  })
})
