import { APIError } from 'better-auth/api'
import { sendSignInLink, signOut } from './auth'

const { signInMagicLink, signOutApi } = vi.hoisted(() => ({ signInMagicLink: vi.fn(), signOutApi: vi.fn() }))
vi.mock('../auth', () => ({ getAuth: () => ({ api: { signInMagicLink, signOut: signOutApi } }) }))
vi.mock('next/headers', () => import('@/test/next'))
vi.mock('next/navigation', () => import('@/test/next'))

function form(fields: Record<string, string>) {
  const data = new FormData()
  for (const [name, value] of Object.entries(fields)) data.set(name, value)
  return data
}

beforeEach(() => {
  signInMagicLink.mockReset()
  signOutApi.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('sendSignInLink', () => {
  it('sends a link and says where it went', async () => {
    const state = await sendSignInLink({}, form({ email: 'sam@example.com', name: 'Sam' }))
    expect(state).toEqual({ sentTo: 'sam@example.com' })
    expect(signInMagicLink).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ email: 'sam@example.com', name: 'Sam' }),
      }),
    )
  })

  it('rejects a bad email and keeps what was typed', async () => {
    const state = await sendSignInLink({}, form({ email: 'nope', name: 'Sam' }))
    expect(state).toMatchObject({ error: 'Enter a valid email address', email: 'nope', name: 'Sam' })
  })

  it('shows Better Auth refusals, like rate limits', async () => {
    signInMagicLink.mockRejectedValue(new APIError('TOO_MANY_REQUESTS', { message: 'Too many requests' }))
    const state = await sendSignInLink({}, form({ email: 'sam@example.com' }))
    expect(state).toMatchObject({ error: 'Too many requests', email: 'sam@example.com' })
  })

  it('turns a failed send into a message rather than a crash', async () => {
    signInMagicLink.mockRejectedValue(new Error('Resend rejected the email (422)'))
    const state = await sendSignInLink({}, form({ email: 'sam@example.com' }))
    expect(state).toMatchObject({ error: "Couldn't send the email. Try again in a minute.", email: 'sam@example.com' })
    expect(console.error).toHaveBeenCalled()
  })
})

/** @see docs/deck-sharing.md § "Returning after sign-in" - with an email link, `next` rides along in the callback URL */
describe('sendSignInLink with somewhere to go next', () => {
  it('carries `next` through Welcome, and back to sign-in if the link fails', async () => {
    await sendSignInLink({}, form({ email: 'sam@example.com', next: '/d/abc/request' }))
    expect(signInMagicLink.mock.calls[0][0].body).toMatchObject({
      callbackURL: '/welcome?next=%2Fd%2Fabc%2Frequest',
      errorCallbackURL: '/sign-in?error=link&next=%2Fd%2Fabc%2Frequest',
    })
  })

  it('goes to Welcome alone without one', async () => {
    await sendSignInLink({}, form({ email: 'sam@example.com' }))
    expect(signInMagicLink.mock.calls[0][0].body).toMatchObject({
      callbackURL: '/welcome',
      errorCallbackURL: '/sign-in?error=link',
    })
  })

  it('drops a `next` that leads off the site', async () => {
    await sendSignInLink({}, form({ email: 'sam@example.com', next: '//evil.example' }))
    expect(signInMagicLink.mock.calls[0][0].body).toMatchObject({ callbackURL: '/welcome' })
  })
})

describe('signOut', () => {
  it('signs out and goes home', async () => {
    await expect(signOut()).rejects.toThrow(/^Redirected to \/$/)
    expect(signOutApi).toHaveBeenCalledOnce()
  })

  it('still goes home when already signed out', async () => {
    signOutApi.mockRejectedValue(new APIError('BAD_REQUEST', { message: 'No session' }))
    await expect(signOut()).rejects.toThrow(/^Redirected to \/$/)
  })

  it('lets anything unexpected surface as a real error', async () => {
    signOutApi.mockRejectedValue(new Error('D1 is down'))
    await expect(signOut()).rejects.toThrow('D1 is down')
  })
})
