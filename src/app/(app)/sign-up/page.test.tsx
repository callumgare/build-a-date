/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react'
import { signInAs } from '@/test/session'
import SignUp from './page'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => import('@/test/next'))
vi.mock('next/headers', () => import('@/test/next'))
vi.mock('@opennextjs/cloudflare', () => import('@/test/cloudflare'))
vi.mock('@/db', () => import('@/test/cloudflare'))
vi.mock('@/lib/auth-config', () => import('@/test/session'))
vi.mock('next/link', () => ({ default: (props: object) => <a {...props} /> }))
vi.mock('@/components/auth/EmailLinkForm', () => ({
  default: ({ next }: { next?: string }) => <p>Sign-up form, then {next ?? 'nowhere'}</p>,
}))

function open(searchParams: Record<string, string> = {}) {
  return SignUp({ searchParams: Promise.resolve(searchParams) } as PageProps<'/sign-up'>)
}

beforeEach(() => {
  signInAs(null)
})

/** @see docs/deck-sharing.md § "Returning after sign-in" */
describe('/sign-up', () => {
  it('carries `next` into the form, and the link to sign in', async () => {
    render(await open({ next: '/d/abc/request' }))
    expect(screen.getByText('Sign-up form, then /d/abc/request')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in?next=%2Fd%2Fabc%2Frequest')
  })

  it('drops a `next` that leads off the site', async () => {
    render(await open({ next: 'https://evil.example' }))
    expect(screen.getByText('Sign-up form, then nowhere')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in')
  })

  it('sends someone already signed in on to `next`, or their decks', async () => {
    signInAs({ id: 'sam', name: 'Sam', email: 'sam@example.com' })
    await expect(open({ next: '/d/abc/request' })).rejects.toThrow('Redirected to /d/abc/request')
    await expect(open()).rejects.toThrow(/^Redirected to \/decks$/)
  })
})
