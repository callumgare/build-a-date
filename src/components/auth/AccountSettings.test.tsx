/** @vitest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AccountSettings from './AccountSettings'

const { deletePasskey, router } = vi.hoisted(() => ({
  deletePasskey: vi.fn(),
  router: { push: vi.fn(), refresh: vi.fn() },
}))
vi.mock('@/lib/auth-client', () => ({
  authClient: { passkey: { deletePasskey, addPasskey: vi.fn() } },
  passkeyName: () => 'This device',
  wasCancelled: () => false,
}))
vi.mock('@/lib/actions/auth', () => ({ signOut: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => router }))

const laptop = { id: 'pk1', name: 'Mac', createdAt: new Date('2026-09-01T10:00:00Z') }
const phone = { id: 'pk2', name: 'iPhone', createdAt: new Date('2026-09-02T10:00:00Z') }

beforeEach(() => {
  deletePasskey.mockReset()
  deletePasskey.mockResolvedValue({ data: {}, error: null })
  router.push.mockReset()
  router.refresh.mockReset()
})

afterEach(() => vi.restoreAllMocks())

describe('AccountSettings', () => {
  it("says so when there's no passkey yet", () => {
    render(<AccountSettings passkeys={[]} />)
    expect(screen.getByText(/You don't have a passkey yet/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
  })

  it('warns before removing the only passkey', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    render(<AccountSettings passkeys={[laptop]} />)

    await user.click(screen.getByRole('button', { name: 'Remove' }))
    expect(confirm).toHaveBeenCalledWith(expect.stringMatching(/^This is your only passkey\./))
    expect(deletePasskey).not.toHaveBeenCalled()
  })

  it('asks before removing one of several passkeys, and keeps it if the answer is no', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    render(<AccountSettings passkeys={[laptop, phone]} />)

    await user.click(screen.getAllByRole('button', { name: 'Remove' })[1])
    expect(confirm).toHaveBeenCalledWith('Remove "iPhone"?')
    expect(deletePasskey).not.toHaveBeenCalled()
  })

  it('removes a passkey once confirmed and refreshes the list', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(<AccountSettings passkeys={[laptop, phone]} />)

    await user.click(screen.getAllByRole('button', { name: 'Remove' })[0])
    expect(deletePasskey).toHaveBeenCalledWith({ id: 'pk1' })
    await waitFor(() => expect(router.refresh).toHaveBeenCalled())
  })

  it('shows why a passkey could not be removed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    deletePasskey.mockResolvedValue({ data: null, error: { message: 'Passkey not found' } })
    const user = userEvent.setup()
    render(<AccountSettings passkeys={[laptop, phone]} />)

    await user.click(screen.getAllByRole('button', { name: 'Remove' })[0])
    expect(await screen.findByRole('alert')).toHaveTextContent('Passkey not found')
    expect(router.refresh).not.toHaveBeenCalled()
  })
})
