/** @vitest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CELEBRATE_EVENT } from './galaxy/sparkle'
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

  /** @see docs/plans.md § "Sharing a plan" */
  describe('straight after Save plan or Update Plan', () => {
    beforeEach(() => {
      window.history.replaceState(null, '', '/p/plan42?share')
    })

    it('opens the dialog by itself, and takes ?share off the address', () => {
      render(<SharePlanButton title="Our date" openOnLoad />)
      expect(screen.getByRole('dialog')).toHaveAttribute('open')
      expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument()
      expect(window.location.search).toBe('')
      expect(screen.queryByRole('link', { name: 'Open your plan' })).not.toBeInTheDocument()
    })

    it('copies the plan link without ?share', async () => {
      const user = userEvent.setup()
      render(<SharePlanButton title="Our date" openOnLoad />)
      window.history.replaceState(null, '', '/p/plan42?share')

      await user.click(screen.getByRole('button', { name: 'Copy link' }))
      expect(await navigator.clipboard.readText()).toBe(`${window.location.origin}/p/plan42`)
    })

    it("offers the device's share sheet from the dialog where there is one", async () => {
      const share = vi.fn().mockResolvedValue(undefined)
      setShare(share)
      const user = userEvent.setup()
      render(<SharePlanButton title="Our date" openOnLoad />)

      await user.click(screen.getByRole('button', { name: 'Share…' }))
      expect(share).toHaveBeenCalledWith({ title: 'Our date', url: `${window.location.origin}/p/plan42` })
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('has no Share… without a share sheet', () => {
      render(<SharePlanButton title="Our date" openOnLoad />)
      expect(screen.queryByRole('button', { name: 'Share…' })).not.toBeInTheDocument()
    })
  })

  it("doesn't open the dialog by itself otherwise", () => {
    render(<SharePlanButton title="Our date" />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  /** @see docs/background.md § "Bursts" */
  describe('the background bursts into sparkle', () => {
    const bursts = vi.fn()
    beforeEach(() => window.addEventListener(CELEBRATE_EVENT, bursts))
    afterEach(() => {
      window.removeEventListener(CELEBRATE_EVENT, bursts)
      bursts.mockReset()
    })

    it('when a plan has just been saved', () => {
      render(<SharePlanButton title="Our date" openOnLoad />)
      expect(bursts).toHaveBeenCalledOnce()
    })

    it('when the plan is shared from the share sheet', async () => {
      setShare(vi.fn().mockResolvedValue(undefined))
      const user = userEvent.setup()
      render(<SharePlanButton title="Our date" />)
      await user.click(screen.getByRole('button', { name: 'Share' }))
      await waitFor(() => expect(bursts).toHaveBeenCalledOnce())
    })

    it('when its link is copied', async () => {
      const user = userEvent.setup()
      render(<SharePlanButton title="Our date" />)
      await user.click(screen.getByRole('button', { name: 'Share' }))
      expect(bursts).not.toHaveBeenCalled()
      await user.click(screen.getByRole('button', { name: 'Copy link' }))
      await waitFor(() => expect(bursts).toHaveBeenCalledOnce())
    })

    it('not when the share sheet is closed without sharing', async () => {
      setShare(vi.fn().mockRejectedValue(new DOMException('Share cancelled', 'AbortError')))
      const user = userEvent.setup()
      render(<SharePlanButton title="Our date" />)
      await user.click(screen.getByRole('button', { name: 'Share' }))
      expect(bursts).not.toHaveBeenCalled()
    })

    it('not just for opening the page', () => {
      render(<SharePlanButton title="Our date" />)
      expect(bursts).not.toHaveBeenCalled()
    })
  })
})
