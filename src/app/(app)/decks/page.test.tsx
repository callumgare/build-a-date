/** @vitest-environment jsdom */
import { render, screen, within } from '@testing-library/react'
import * as decks from '@/lib/decks'
import { useTestDb } from '@/test/cloudflare'
import { createTestDb, createUser } from '@/test/db'
import { signInAs } from '@/test/session'
import Decks from './page'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => import('@/test/next'))
vi.mock('next/headers', () => import('@/test/next'))
vi.mock('@opennextjs/cloudflare', () => import('@/test/cloudflare'))
vi.mock('@/db', () => import('@/test/cloudflare'))
vi.mock('@/lib/auth-config', () => import('@/test/session'))
vi.mock('next/link', () => ({ default: (props: object) => <a {...props} /> }))
vi.mock('@/components/decks/NewDeckButton', () => ({
  default: ({ label = 'New deck' }: { label?: string }) => <button type="button">{label}</button>,
}))

let db: ReturnType<typeof createTestDb>

function signIn(id: string) {
  signInAs({ id, name: id, email: `${id}@example.com` })
}

beforeEach(async () => {
  db = createTestDb()
  useTestDb(db)
  for (const id of ['alex', 'sam', 'jo']) await createUser(db, id)
})

/** @see docs/deck-sharing.md § "Shared decks" */
describe('/decks', () => {
  it('invites someone with no decks to make their first', async () => {
    signIn('alex')
    render(await Decks())
    expect(screen.getByRole('button', { name: 'Make your first deck' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Shared decks' })).not.toBeInTheDocument()
  })

  it('lists your decks with counts, then the decks you edit with whose they are', async () => {
    const mine = await decks.createDeck(db, 'alex', { name: 'Weekend', template: 'empty' })
    const card = await decks.saveCard(db, 'alex', mine.id, null, { title: 'Picnic' })
    await decks.savePlan(db, mine.shareId, [card.id])
    await decks.requestEditAccess(db, 'jo', mine.shareId)
    const theirs = await decks.createDeck(db, 'sam', { name: "Sam's ideas", template: 'empty' })
    await decks.requestEditAccess(db, 'alex', theirs.shareId)
    await decks.respondToAccessRequest(db, 'sam', theirs.id, 'alex', true)

    signIn('alex')
    render(await Decks())
    const [own, shared] = screen.getAllByRole('list')
    expect(within(own).getByRole('link')).toHaveAttribute('href', `/decks/${mine.id}`)
    expect(within(own).getByRole('link')).toHaveTextContent('Weekend1 idea · 1 plan · 1 edit request')
    expect(screen.getByRole('heading', { name: 'Shared decks' })).toBeInTheDocument()
    expect(within(shared).getByRole('link')).toHaveTextContent("Sam's ideassam's deck · 0 ideas · 0 plans")
  })

  it("doesn't list a deck you've only asked to edit", async () => {
    const theirs = await decks.createDeck(db, 'sam', { name: "Sam's ideas", template: 'empty' })
    await decks.requestEditAccess(db, 'alex', theirs.shareId)

    signIn('alex')
    render(await Decks())
    expect(screen.queryByText("Sam's ideas")).not.toBeInTheDocument()
  })
})
