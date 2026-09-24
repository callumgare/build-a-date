/** @vitest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddPasskeyButton from './AddPasskeyButton'

const { addPasskey, wasCancelled } = vi.hoisted(() => ({ addPasskey: vi.fn(), wasCancelled: vi.fn() }))
vi.mock('@/lib/auth-client', () => ({
  authClient: { passkey: { addPasskey } },
  passkeyName: () => 'iPhone',
  wasCancelled,
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

beforeEach(() => {
  addPasskey.mockReset()
  wasCancelled.mockReset()
  wasCancelled.mockReturnValue(false)
})

describe('AddPasskeyButton', () => {
  it('waits for the device, then says the passkey was added', async () => {
    const added = deferred<{ data: object; error: null }>()
    addPasskey.mockReturnValue(added.promise)
    const onAdded = vi.fn()
    const user = userEvent.setup()
    render(<AddPasskeyButton onAdded={onAdded} />)

    await user.click(screen.getByRole('button', { name: 'Create a passkey' }))
    expect(addPasskey).toHaveBeenCalledWith({ name: 'iPhone' })
    expect(screen.getByRole('button', { name: 'Waiting for your device…' })).toBeDisabled()
    expect(onAdded).not.toHaveBeenCalled()

    added.resolve({ data: {}, error: null })
    await waitFor(() => expect(onAdded).toHaveBeenCalled())
    expect(screen.getByRole('button', { name: 'Create a passkey' })).toBeEnabled()
  })

  it('says nothing when the prompt is closed', async () => {
    addPasskey.mockResolvedValue({ data: null, error: { code: 'AUTH_CANCELLED', message: 'Cancelled' } })
    wasCancelled.mockReturnValue(true)
    const onAdded = vi.fn()
    const user = userEvent.setup()
    render(<AddPasskeyButton label="Add a passkey" onAdded={onAdded} />)

    await user.click(screen.getByRole('button', { name: 'Add a passkey' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add a passkey' })).toBeEnabled())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(onAdded).not.toHaveBeenCalled()
  })

  it('shows why a passkey could not be created', async () => {
    addPasskey.mockResolvedValue({ data: null, error: { message: 'This device already has a passkey' } })
    const onAdded = vi.fn()
    const user = userEvent.setup()
    render(<AddPasskeyButton onAdded={onAdded} />)

    await user.click(screen.getByRole('button', { name: 'Create a passkey' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('This device already has a passkey')
    expect(onAdded).not.toHaveBeenCalled()
  })
})
