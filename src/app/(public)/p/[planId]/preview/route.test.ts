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

async function weekendPlan() {
  const deck = await decks.createDeck(db, 'owner', { name: 'Weekend', template: 'empty' })
  const card = await decks.saveCard(db, 'owner', deck.id, null, { title: 'Picnic' })
  return decks.savePlan(db, deck.shareId, [card.id])
}

beforeEach(async () => {
  db = createTestDb()
  useTestDb(db)
  await createUser(db, 'owner')
})

/** @see docs/share-previews.md § "Storing and serving" */
describe("a plan's link preview", () => {
  it('is the JPEG last kept, cached for good at the address the page gives', async () => {
    const plan = await weekendPlan()
    await savePreview(db, 'plan', plan.id, 'abc', fakeJpeg())

    const response = await get(plan.id, '?v=abc')
    expect(response.headers.get('content-type')).toBe('image/jpeg')
    expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(fakeJpeg())
  })

  it('is only cached briefly at any other address, which may mean an older picture', async () => {
    const plan = await weekendPlan()
    await savePreview(db, 'plan', plan.id, 'abc', fakeJpeg())
    expect((await get(plan.id, '?v=older')).headers.get('cache-control')).toBe('public, max-age=300')
    expect((await get(plan.id)).headers.get('cache-control')).toBe('public, max-age=300')
  })

  it("isn't there for a plan with no picture yet, or no plan", async () => {
    expect((await get((await weekendPlan()).id)).status).toBe(404)
    expect((await get('nope')).status).toBe(404)
  })
})
