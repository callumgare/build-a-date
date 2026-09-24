import { APIError } from 'better-auth/api'
import { sendSignInLink } from './auth'

const signInMagicLink = vi.hoisted(() => vi.fn())
vi.mock('../auth', () => ({ getAuth: () => ({ api: { signInMagicLink } }) }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))

function form(fields: Record<string, string>) {
  const data = new FormData()
  for (const [name, value] of Object.entries(fields)) data.set(name, value)
  return data
}

beforeEach(() => {
  signInMagicLink.mockReset()
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
