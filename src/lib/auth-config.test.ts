import { createTestDb } from '@/test/db'
import { baseURLConfig, createAuth } from './auth-config'
import { devOutbox } from './email'

const local = {
  BETTER_AUTH_URL: 'http://localhost:3000',
  BETTER_AUTH_SECRET: 'test-secret-that-is-at-least-32-chars',
  EMAIL_FROM: 'Dates <hi@example.com>',
}

// Asks for a sign-in link from a page on `origin`, sent to `host`, and
// returns the origin the emailed link points at.
async function signInLinkFrom(origin: string, host = origin) {
  const auth = createAuth(local, createTestDb())
  const response = await auth.handler(
    new Request(`${host}/api/auth/sign-in/magic-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin },
      body: JSON.stringify({ email: 'sam@example.com', callbackURL: '/decks' }),
    }),
  )
  if (!response.ok) return response.status
  const link = devOutbox.at(-1)?.text.match(/https?:\/\/\S+/)?.[0]
  return link && new URL(link).origin
}

describe('sign-in links', () => {
  beforeEach(() => {
    devOutbox.length = 0
  })

  it('point at localhost when signing in from localhost', async () => {
    expect(await signInLinkFrom('http://localhost:3000')).toBe('http://localhost:3000')
  })

  it('point at the network address the app was opened from locally', async () => {
    expect(await signInLinkFrom('http://192.168.1.56:3000')).toBe('http://192.168.1.56:3000')
    expect(await signInLinkFrom('https://192.168.1.56:3000')).toBe('https://192.168.1.56:3000')
  })

  it('are refused to pages outside the local network', async () => {
    expect(await signInLinkFrom('http://evil.example:3000')).toBe(403)
  })

  it('never point at a host outside the local network', async () => {
    expect(await signInLinkFrom('http://localhost:3000', 'http://evil.example:3000')).toBe('http://localhost:3000')
  })
})

// As the email form's server action does: headers, but no request URL.
async function signInLinkFromHeaders(headers: Record<string, string>) {
  const auth = createAuth(local, createTestDb())
  await auth.api.signInMagicLink({
    body: { email: 'sam@example.com', callbackURL: '/decks' },
    headers: new Headers(headers),
  })
  const link = devOutbox.at(-1)?.text.match(/https?:\/\/\S+/)?.[0]
  return link && new URL(link).origin
}

describe('sign-in links from a server action', () => {
  beforeEach(() => {
    devOutbox.length = 0
  })

  it('keep the scheme `next dev` was reached over', async () => {
    const lan = { host: '192.168.1.56:3000', origin: 'http://192.168.1.56:3000' }
    expect(await signInLinkFromHeaders({ ...lan, 'x-forwarded-proto': 'http' })).toBe('http://192.168.1.56:3000')
    expect(await signInLinkFromHeaders({ ...lan, 'x-forwarded-proto': 'https' })).toBe('https://192.168.1.56:3000')
  })

  it('never point at a forwarded host outside the local network', async () => {
    expect(
      await signInLinkFromHeaders({
        host: 'localhost:3000',
        origin: 'http://localhost:3000',
        'x-forwarded-host': 'evil.example:3000',
        'x-forwarded-proto': 'http',
      }),
    ).toBe('http://localhost:3000')
  })
})

describe('baseURLConfig', () => {
  it('is fixed to BETTER_AUTH_URL anywhere but localhost', () => {
    expect(baseURLConfig('https://build-a-date.cals.cafe')).toBe('https://build-a-date.cals.cafe')
  })
})
