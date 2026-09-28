/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react'
import { signInAs } from '@/test/session'
import Home from './page'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => import('@/test/next'))
vi.mock('next/headers', () => import('@/test/next'))
vi.mock('@opennextjs/cloudflare', () => import('@/test/cloudflare'))
vi.mock('@/db', () => import('@/test/cloudflare'))
vi.mock('@/lib/auth-config', () => import('@/test/session'))
vi.mock('next/link', () => ({ default: (props: object) => <a {...props} /> }))

describe('the home page', () => {
  /** @see docs/sample-deck.md § "Sample deck" */
  it('invites someone signed out to try the sample deck, make their own, or sign in', async () => {
    signInAs(null)
    render(await Home())
    expect(screen.getByRole('link', { name: 'Try a sample deck' })).toHaveAttribute('href', '/sample')
    expect(screen.getByRole('link', { name: 'Make your own deck' })).toHaveAttribute('href', '/sign-up')
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in')
  })

  /** @see docs/sample-deck.md § "Sample deck" - someone signed in never sees the home page */
  it('sends someone signed in to their decks', async () => {
    signInAs({ id: 'sam', name: 'Sam', email: 'sam@example.com' })
    await expect(Home()).rejects.toThrow(/^Redirected to \/decks$/)
  })
})
