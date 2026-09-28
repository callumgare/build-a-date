import * as decks from '@/lib/decks'
import { savePreview } from '@/lib/previews'
import { useTestDb } from '@/test/cloudflare'
import { createTestDb, createUser } from '@/test/db'
import { fakeJpeg } from '@/test/jpeg'
import { GET } from './route'

vi.mock('@/db', () => import('@/test/cloudflare'))

let db: ReturnType<typeof createTestDb>
let deck: Awaited<ReturnType<typeof decks.createDeck>>

function get(shareId: string, query = '') {
  return GET(new Request(`http://localhost:3000/d/${shareId}/preview${query}`), {
    params: Promise.resolve({ shareId }),
  })
}

beforeEach(async () => {
  db = createTestDb()
  useTestDb(db)
  await createUser(db, 'owner')
  deck = await decks.createDeck(db, 'owner', { name: 'Weekend', template: 'empty' })
})

/** @see docs/share-previews.md § "Storing and serving" */
describe("a shared deck's link preview", () => {
  it('is the JPEG last kept, cached for good at the address the page gives', async () => {
    await savePreview(db, 'deck', deck.id, 'abc', fakeJpeg())
    const response = await get(deck.shareId, '?v=abc')
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/jpeg')
    expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(fakeJpeg())
  })

  it('is only cached briefly at any other address, which may mean an older picture', async () => {
    await savePreview(db, 'deck', deck.id, 'abc', fakeJpeg())
    expect((await get(deck.shareId, '?v=older')).headers.get('cache-control')).toBe('public, max-age=300')
    expect((await get(deck.shareId)).headers.get('cache-control')).toBe('public, max-age=300')
  })

  it("isn't there for a deck with no picture yet, or no deck", async () => {
    expect((await get(deck.shareId)).status).toBe(404)
    expect((await get('nope')).status).toBe(404)
  })
})
