/** @vitest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SharePlanButton from './SharePlanButton'

function setShare(share: Navigator['share'] | undefined) {
  Object.defineProperty(navigator, 'share', { value: share, configurable: true })
}

beforeEach(() => {
  setShare(undefined)
  window.history.replaceState(null, '', '/p/plan42')
})

describe('SharePlanButton', () => {
  it("uses the device's share sheet where there is one", async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    setShare(share)
    const user = userEvent.setup()
    render(<SharePlanButton title="Our date" />)

    await user.click(screen.getByRole('button', { name: 'Share' }))
    expect(share).toHaveBeenCalledWith({ title: 'Our date', url: `${window.location.origin}/p/plan42` })
    expect(screen.queryByRole('button', { name: 'Copy link' })).not.toBeInTheDocument()
  })

  it('does nothing more when the share sheet is closed', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('Share cancelled', 'AbortError'))
    setShare(share)
    const user = userEvent.setup()
    render(<SharePlanButton title="Our date" />)

    await user.click(screen.getByRole('button', { name: 'Share' }))
    await waitFor(() => expect(share).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: 'Copy link' })).not.toBeInTheDocument()
  })

  it("offers the link to copy when the share sheet doesn't work", async () => {
    setShare(vi.fn().mockRejectedValue(new DOMException('Not allowed', 'NotAllowedError')))
    const user = userEvent.setup()
    render(<SharePlanButton title="Our date" />)

    await user.click(screen.getByRole('button', { name: 'Share' }))
    expect(await screen.findByRole('button', { name: 'Copy link' })).toBeInTheDocument()
  })

  it('offers the link to copy without a share sheet, and copies it', async () => {
    const user = userEvent.setup()
    render(<SharePlanButton title="Our date" />)

    await user.click(screen.getByRole('button', { name: 'Share' }))
    await user.click(screen.getByRole('button', { name: 'Copy link' }))
    expect(await navigator.clipboard.readText()).toBe(`${window.location.origin}/p/plan42`)
    expect(screen.getByRole('button', { name: 'Copied!' })).toBeInTheDocument()
  })
})
