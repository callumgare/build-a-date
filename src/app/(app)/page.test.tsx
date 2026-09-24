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
  it('invites someone signed out to make a deck or sign in', async () => {
    signInAs(null)
    render(await Home())
    expect(screen.getByRole('link', { name: 'Make a deck' })).toHaveAttribute('href', '/sign-up')
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in')
  })

  it('sends someone signed in to their decks', async () => {
    signInAs({ id: 'sam', name: 'Sam', email: 'sam@example.com' })
    await expect(Home()).rejects.toThrow(/^Redirected to \/decks$/)
  })
})
