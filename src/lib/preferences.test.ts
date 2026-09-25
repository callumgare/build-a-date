import { createTestDb, createUser } from '@/test/db'
import { getDeckSort, saveDeckSort } from './preferences'

let db: ReturnType<typeof createTestDb>

beforeEach(async () => {
  db = createTestDb()
  for (const id of ['picker', 'other']) await createUser(db, id)
})

/** @see docs/deck-sorting.md § "Remembering the choice" */
describe('the saved deck sort', () => {
  it('is Random for an account that has never picked one', async () => {
    expect(await getDeckSort(db, 'picker')).toBe('random')
  })

  it('is the sort last picked', async () => {
    await saveDeckSort(db, 'picker', 'interest')
    expect(await getDeckSort(db, 'picker')).toBe('interest')
    await saveDeckSort(db, 'picker', 'added')
    expect(await getDeckSort(db, 'picker')).toBe('added')
  })

  it('belongs to one account only', async () => {
    await saveDeckSort(db, 'picker', 'interest')
    expect(await getDeckSort(db, 'other')).toBe('random')
  })
})
