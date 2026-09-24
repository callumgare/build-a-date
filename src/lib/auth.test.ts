import { signInAs } from '@/test/session'
import { requireUser } from './auth'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => import('@/test/next'))
vi.mock('next/headers', () => import('@/test/next'))
vi.mock('@opennextjs/cloudflare', () => import('@/test/cloudflare'))
vi.mock('@/db', () => import('@/test/cloudflare'))
vi.mock('@/lib/auth-config', () => import('@/test/session'))

describe('requireUser', () => {
  it('gives back whoever is signed in', async () => {
    const user = { id: 'sam', name: 'Sam', email: 'sam@example.com' }
    signInAs(user)
    expect(await requireUser()).toEqual(user)
  })

  it('sends someone signed out to sign in', async () => {
    signInAs(null)
    await expect(requireUser()).rejects.toThrow(/^Redirected to \/sign-in$/)
  })

  /** @see docs/deck-sharing.md § "Returning after sign-in" - `requireUser(next)` adds one when it sends someone to sign in */
  it('says where to come back to after signing in', async () => {
    signInAs(null)
    await expect(requireUser('/d/abc/request?x=1')).rejects.toThrow(
      'Redirected to /sign-in?next=%2Fd%2Fabc%2Frequest%3Fx%3D1',
    )
  })
})
