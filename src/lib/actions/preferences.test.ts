import { useTestDb } from '@/test/cloudflare'
import { createTestDb, createUser } from '@/test/db'
import { signInAs } from '@/test/session'
import type { DeckSort } from '../deck-order'
import { getDeckSort } from '../preferences'
import { saveDeckSort } from './preferences'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => import('@/test/next'))
vi.mock('next/headers', () => import('@/test/next'))
vi.mock('@opennextjs/cloudflare', () => import('@/test/cloudflare'))
vi.mock('@/db', () => import('@/test/cloudflare'))
vi.mock('@/lib/auth-config', () => import('@/test/session'))

let db: ReturnType<typeof createTestDb>

beforeEach(async () => {
  db = createTestDb()
  useTestDb(db)
  await createUser(db, 'picker')
  signInAs({ id: 'picker', name: 'picker', email: 'picker@example.com' })
})

/** @see docs/deck-sorting.md § "Remembering the choice" */
describe('saveDeckSort', () => {
  it("saves the sort to the signed-in visitor's account", async () => {
    expect(await saveDeckSort('interest')).toEqual({ ok: true, data: undefined })
    expect(await getDeckSort(db, 'picker')).toBe('interest')
  })

  it('saves nothing, and sends no one to sign in, for someone signed out', async () => {
    signInAs(null)
    expect(await saveDeckSort('interest')).toMatchObject({ ok: false })
    expect(await getDeckSort(db, 'picker')).toBe('random')
  })

  it('turns a sort that does not exist into a message', async () => {
    expect(await saveDeckSort('shortest' as DeckSort)).toMatchObject({ ok: false })
    expect(await getDeckSort(db, 'picker')).toBe('random')
  })
})
