/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react'
import { api, signInAs } from '@/test/session'
import Settings from './page'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => import('@/test/next'))
vi.mock('next/headers', () => import('@/test/next'))
vi.mock('@opennextjs/cloudflare', () => import('@/test/cloudflare'))
vi.mock('@/db', () => import('@/test/cloudflare'))
vi.mock('@/lib/auth-config', () => import('@/test/session'))
vi.mock('@/components/auth/NameForm', () => ({ default: ({ name }: { name: string }) => <p>Name: {name}</p> }))
vi.mock('@/components/auth/AccountSettings', () => ({
  default: ({ passkeys }: { passkeys: unknown[] }) => <p>{passkeys.length} passkeys</p>,
}))

/** @see docs/account-settings.md § "Account settings" */
describe('Settings', () => {
  it('shows the email they are signed in with, their name and their passkeys', async () => {
    signInAs({ id: 'sam', name: 'Sam', email: 'sam@example.com' })
    api.listPasskeys.mockResolvedValue([{ id: 'key', createdAt: new Date() }])
    render(await Settings())
    expect(screen.getByText('sam@example.com')).toBeInTheDocument()
    expect(screen.getByText('Name: Sam')).toBeInTheDocument()
    expect(screen.getByText('1 passkeys')).toBeInTheDocument()
  })

  it('sends someone signed out to sign in', async () => {
    signInAs(null)
    await expect(Settings()).rejects.toThrow(/^Redirected to \/sign-in/)
  })
})
