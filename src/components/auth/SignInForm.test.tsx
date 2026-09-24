/** @vitest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SignInForm from './SignInForm'

const { passkey, router } = vi.hoisted(() => ({
  passkey: vi.fn(),
  router: { push: vi.fn(), refresh: vi.fn() },
}))
vi.mock('next/navigation', () => ({ useRouter: () => router }))
vi.mock('@/lib/auth-client', () => ({
  authClient: { signIn: { passkey } },
  wasCancelled: (error: { code?: string }) => error.code === 'AUTH_CANCELLED',
}))
vi.mock('./EmailLinkForm', () => ({ default: () => null }))

beforeEach(() => {
  passkey.mockReset()
  router.push.mockReset()
  router.refresh.mockReset()
})

describe('SignInForm', () => {
  // Browsers leave it out over plain http anywhere but localhost, as on a
  // network address. jsdom has no PublicKeyCredential either.
  it('renders without passkey support in the browser', () => {
    expect(window.PublicKeyCredential).toBeUndefined()
    render(<SignInForm />)
    expect(screen.getByRole('button', { name: /passkey/i })).toBeInTheDocument()
  })

  /** @see docs/deck-sharing.md § "Returning after sign-in" - with a passkey, they go straight to `next` */
  it('goes straight to where they were after signing in with a passkey', async () => {
    passkey.mockResolvedValue({ data: { session: {} }, error: null })
    const user = userEvent.setup()
    render(<SignInForm next="/d/share123/request" />)

    await user.click(screen.getByRole('button', { name: 'Sign in with a passkey' }))
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/d/share123/request'))
    expect(router.refresh).toHaveBeenCalled()
  })

  it('goes to their decks after signing in with a passkey from nowhere in particular', async () => {
    passkey.mockResolvedValue({ data: { session: {} }, error: null })
    const user = userEvent.setup()
    render(<SignInForm />)

    await user.click(screen.getByRole('button', { name: 'Sign in with a passkey' }))
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/decks'))
  })

  it("shows why a passkey didn't work", async () => {
    passkey.mockResolvedValue({ data: null, error: { message: 'Unknown passkey' } })
    const user = userEvent.setup()
    render(<SignInForm />)

    await user.click(screen.getByRole('button', { name: 'Sign in with a passkey' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Unknown passkey')
    expect(router.push).not.toHaveBeenCalled()
  })

  it('says nothing when the passkey prompt is closed', async () => {
    passkey.mockResolvedValue({ data: null, error: { code: 'AUTH_CANCELLED', message: 'Cancelled' } })
    const user = userEvent.setup()
    render(<SignInForm />)

    await user.click(screen.getByRole('button', { name: 'Sign in with a passkey' }))
    await waitFor(() => expect(passkey).toHaveBeenCalled())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(router.push).not.toHaveBeenCalled()
  })

  it('says when a sign-in link has expired', () => {
    render(<SignInForm linkFailed />)
    expect(screen.getByRole('alert')).toHaveTextContent(
      'That sign-in link has expired or was already used. Request a new one below.',
    )
  })

  describe('with passkeys offered in autofill', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'PublicKeyCredential', {
        value: { isConditionalMediationAvailable: () => Promise.resolve(true) },
        configurable: true,
      })
    })

    afterEach(() => {
      Reflect.deleteProperty(window, 'PublicKeyCredential')
    })

    /** @see docs/deck-sharing.md § "Returning after sign-in" - with a passkey, they go straight to `next` */
    it('signs in with a passkey picked from autofill', async () => {
      passkey.mockResolvedValue({ data: { session: {} }, error: null })
      render(<SignInForm next="/d/share123/request" />)

      await waitFor(() => expect(router.push).toHaveBeenCalledWith('/d/share123/request'))
      expect(passkey).toHaveBeenCalledWith({ autoFill: true })
    })
  })
})
