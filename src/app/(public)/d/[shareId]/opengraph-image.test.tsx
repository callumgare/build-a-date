import * as decks from '@/lib/decks'
import { renderShareImage } from '@/lib/og/render'
import { useTestDb } from '@/test/cloudflare'
import { createTestDb, createUser } from '@/test/db'
import { NotFoundPage } from '@/test/next'
import { pngSize } from '@/test/png'
import Image, { contentType, size } from './opengraph-image'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => import('@/test/next'))
vi.mock('@opennextjs/cloudflare', () => import('@/test/cloudflare'))
vi.mock('@/db', () => import('@/test/cloudflare'))
vi.mock('@/lib/og/render', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/og/render')>()
  return { ...original, renderShareImage: vi.fn(original.renderShareImage) }
})

let deck: Awaited<ReturnType<typeof decks.createDeck>>

function image(shareId = deck.shareId) {
  return Image({ params: Promise.resolve({ shareId }) })
}

beforeEach(async () => {
  const db = createTestDb()
  useTestDb(db)
  await createUser(db, 'owner')
  deck = await decks.createDeck(db, 'owner', { name: 'Weekend', template: 'empty' })
  for (const title of ['Picnic', 'Hike', 'Karaoke']) await decks.saveCard(db, 'owner', deck.id, null, { title })
  vi.mocked(renderShareImage).mockClear()
})

/** @see docs/share-previews.md § "A deck" */
describe("a shared deck's link preview", () => {
  it('is a 1200×630 PNG', async () => {
    const response = await image()
    expect(contentType).toBe('image/png')
    expect(size).toEqual({ width: 1200, height: 630 })
    expect(response.headers.get('content-type')).toBe('image/png')
    expect(await pngSize(response)).toEqual(size)
  })

  it("draws the deck's name and its cards in a grid, in the deck's order", async () => {
    await image()
    expect(renderShareImage).toHaveBeenCalledWith(expect.objectContaining({ title: 'Weekend', layout: 'grid' }))
    const [{ cards }] = vi.mocked(renderShareImage).mock.calls[0]
    expect(cards.map((card) => card.title)).toEqual(['Picnic', 'Hike', 'Karaoke'])
  })

  it("is not found for a deck that doesn't exist", async () => {
    await expect(image('nope')).rejects.toThrow(NotFoundPage)
  })
})
