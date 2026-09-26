/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NameForm from './NameForm'

const { updateName } = vi.hoisted(() => ({ updateName: vi.fn() }))
vi.mock('@/lib/actions/auth', () => ({ updateName }))

beforeEach(() => {
  updateName.mockReset()
})

/** @see docs/account-settings.md § "Your name" */
describe('NameForm', () => {
  it('starts with the current name', () => {
    render(<NameForm name="Sam" />)
    expect(screen.getByLabelText('Your name')).toHaveValue('Sam')
  })

  it('says so once the new name is saved', async () => {
    updateName.mockResolvedValue({ saved: 'Robin' })
    const user = userEvent.setup()
    render(<NameForm name="Sam" />)

    await user.clear(screen.getByLabelText('Your name'))
    await user.type(screen.getByLabelText('Your name'), 'Robin')
    await user.click(screen.getByRole('button', { name: 'Save name' }))

    expect(await screen.findByRole('status')).toHaveTextContent("Saved. You're now Robin.")
    expect(updateName.mock.calls[0][1].get('name')).toBe('Robin')
  })

  it('shows why the name was turned away and keeps what was typed', async () => {
    updateName.mockResolvedValue({ name: 'Robin', error: 'Sign in again to change your name.' })
    const user = userEvent.setup()
    render(<NameForm name="Sam" />)

    await user.clear(screen.getByLabelText('Your name'))
    await user.type(screen.getByLabelText('Your name'), 'Robin')
    await user.click(screen.getByRole('button', { name: 'Save name' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Sign in again to change your name.')
    expect(screen.getByLabelText('Your name')).toHaveValue('Robin')
  })
})
