/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EmailLinkForm from './EmailLinkForm'

const { sendSignInLink } = vi.hoisted(() => ({ sendSignInLink: vi.fn() }))
vi.mock('@/lib/actions/auth', () => ({ sendSignInLink }))

beforeEach(() => {
  sendSignInLink.mockReset()
  sendSignInLink.mockResolvedValue({ sentTo: 'alex@example.com' })
})

describe('EmailLinkForm', () => {
  /** @see docs/deck-sharing.md § "Returning after sign-in" - with an email link, `next` rides along */
  it('sends where they were headed along with the email', async () => {
    const user = userEvent.setup()
    render(<EmailLinkForm submitLabel="Email me a sign-in link" next="/d/share123/request" />)

    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'alex@example.com')
    await user.click(screen.getByRole('button', { name: 'Email me a sign-in link' }))

    const form: FormData = sendSignInLink.mock.calls[0][1]
    expect(form.get('email')).toBe('alex@example.com')
    expect(form.get('next')).toBe('/d/share123/request')
    expect(await screen.findByRole('status')).toHaveTextContent('We sent a link to alex@example.com.')
  })

  it('shows why the link could not be sent, keeping what was typed', async () => {
    sendSignInLink.mockResolvedValue({ error: "Couldn't send the email.", email: 'alex@example.com', name: 'Alex' })
    const user = userEvent.setup()
    render(<EmailLinkForm askName submitLabel="Sign up" />)

    await user.type(screen.getByRole('textbox', { name: 'Your name' }), 'Alex')
    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'alex@example.com')
    await user.click(screen.getByRole('button', { name: 'Sign up' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't send the email.")
    expect(sendSignInLink.mock.calls[0][1].get('next')).toBeNull()
    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveValue('alex@example.com')
    expect(screen.getByRole('textbox', { name: 'Your name' })).toHaveValue('Alex')
  })
})
