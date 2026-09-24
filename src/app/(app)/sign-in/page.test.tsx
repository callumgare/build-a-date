/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react'
import { signInAs } from '@/test/session'
import SignIn from './page'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => import('@/test/next'))
vi.mock('next/headers', () => import('@/test/next'))
vi.mock('@opennextjs/cloudflare', () => import('@/test/cloudflare'))
vi.mock('@/db', () => import('@/test/cloudflare'))
vi.mock('@/lib/auth-config', () => import('@/test/session'))
vi.mock('next/link', () => ({ default: (props: object) => <a {...props} /> }))
vi.mock('@/components/auth/SignInForm', () => ({
  default: ({ next, linkFailed }: { next?: string; linkFailed?: boolean }) => (
    <p>
      Sign-in form, then {next ?? 'nowhere'}
      {linkFailed && ', link failed'}
    </p>
  ),
}))

function open(searchParams: Record<string, string> = {}) {
  return SignIn({ searchParams: Promise.resolve(searchParams) } as PageProps<'/sign-in'>)
}

beforeEach(() => {
  signInAs(null)
})

describe('/sign-in', () => {
  /** @see docs/deck-sharing.md § "Returning after sign-in" */
  describe('with somewhere to go next', () => {
    it('carries `next` into the form, and the link to make an account', async () => {
      render(await open({ next: '/d/abc/request' }))
      expect(screen.getByText('Sign-in form, then /d/abc/request')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Make an account' })).toHaveAttribute(
        'href',
        '/sign-up?next=%2Fd%2Fabc%2Frequest',
      )
    })

    it('drops a `next` that leads off the site', async () => {
      render(await open({ next: 'https://evil.example' }))
      expect(screen.getByText('Sign-in form, then nowhere')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Make an account' })).toHaveAttribute('href', '/sign-up')
    })

    it('sends someone already signed in on to `next`, or their decks', async () => {
      signInAs({ id: 'sam', name: 'Sam', email: 'sam@example.com' })
      await expect(open({ next: '/d/abc/request' })).rejects.toThrow('Redirected to /d/abc/request')
      await expect(open({ next: '//evil.example' })).rejects.toThrow(/^Redirected to \/decks$/)
    })
  })

  it('passes on that an email link failed', async () => {
    render(await open({ error: 'link' }))
    expect(screen.getByText(/link failed/)).toBeInTheDocument()
  })
})
