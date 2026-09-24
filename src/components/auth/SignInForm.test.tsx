/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react'
import SignInForm from './SignInForm'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
vi.mock('@/lib/auth-client', () => ({ authClient: { signIn: { passkey: vi.fn() } }, wasCancelled: () => false }))
vi.mock('./EmailLinkForm', () => ({ default: () => null }))

describe('SignInForm', () => {
  // Browsers leave it out over plain http anywhere but localhost, as on a
  // network address. jsdom has no PublicKeyCredential either.
  it('renders without passkey support in the browser', () => {
    expect(window.PublicKeyCredential).toBeUndefined()
    render(<SignInForm />)
    expect(screen.getByRole('button', { name: /passkey/i })).toBeInTheDocument()
  })
})
