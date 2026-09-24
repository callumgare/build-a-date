/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react'
import { api, signInAs } from '@/test/session'
import Welcome from './page'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => import('@/test/next'))
vi.mock('next/headers', () => import('@/test/next'))
vi.mock('@opennextjs/cloudflare', () => import('@/test/cloudflare'))
vi.mock('@/db', () => import('@/test/cloudflare'))
vi.mock('@/lib/auth-config', () => import('@/test/session'))
vi.mock('@/components/auth/WelcomePasskey', () => ({
  default: ({ next }: { next: string }) => <p>Then on to {next}</p>,
}))

function open(next?: string) {
  return Welcome({ searchParams: Promise.resolve(next ? { next } : {}) } as PageProps<'/welcome'>)
}

beforeEach(() => {
  signInAs({ id: 'sam', name: 'Sam', email: 'sam@example.com' })
  api.listPasskeys.mockResolvedValue([])
})

/** @see docs/deck-sharing.md § "Returning after sign-in" - Welcome sends them on to `next` */
describe('Welcome', () => {
  it('offers a passkey to someone without one, then sends them on to `next`', async () => {
    render(await open('/d/abc/request'))
    expect(screen.getByRole('heading', { name: 'Welcome, Sam' })).toBeInTheDocument()
    expect(screen.getByText('Then on to /d/abc/request')).toBeInTheDocument()
  })

  it('goes on to their decks without a `next`, or with one that leads off the site', async () => {
    render(await open('//evil.example'))
    expect(screen.getByText('Then on to /decks')).toBeInTheDocument()
  })

  it('sends someone who already has a passkey straight on to `next`', async () => {
    api.listPasskeys.mockResolvedValue([{ id: 'key', createdAt: new Date() }])
    await expect(open('/d/abc/request')).rejects.toThrow('Redirected to /d/abc/request')
    await expect(open()).rejects.toThrow(/^Redirected to \/decks$/)
  })

  it('sends someone signed out to sign in', async () => {
    signInAs(null)
    await expect(open()).rejects.toThrow(/^Redirected to \/sign-in$/)
  })
})
