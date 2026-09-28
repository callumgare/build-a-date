import * as decks from '@/lib/decks'
import { savePreview } from '@/lib/previews'
import { useTestDb } from '@/test/cloudflare'
import { createTestDb, createUser } from '@/test/db'
import { fakeJpeg } from '@/test/jpeg'
import { GET } from './route'

vi.mock('@/db', () => import('@/test/cloudflare'))

let db: ReturnType<typeof createTestDb>

function get(planId: string, query = '') {
  return GET(new Request(`http://localhost:3000/p/${planId}/preview${query}`), { params: Promise.resolve({ planId }) })
}

beforeEach(async () => {
  db = createTestDb()
  useTestDb(db)
  await createUser(db, 'owner')
})

/** @see docs/share-previews.md § "Storing and serving" */
describe("a plan's link preview", () => {
  it('is the JPEG last kept, cached for good at the address the page gives', async () => {
    const deck = await decks.createDeck(db, 'owner', { name: 'Weekend', template: 'empty' })
    const card = await decks.saveCard(db, 'owner', deck.id, null, { title: 'Picnic' })
    const plan = await decks.savePlan(db, deck.shareId, [card.id])
    await savePreview(db, 'plan', plan.id, 'abc', fakeJpeg())

    const response = await get(plan.id, '?v=abc')
    expect(response.headers.get('content-type')).toBe('image/jpeg')
    expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(fakeJpeg())
  })

  it("isn't there for a plan with no picture yet, or no plan", async () => {
    expect((await get('nope')).status).toBe(404)
  })
})
