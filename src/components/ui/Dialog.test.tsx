/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import Dialog from './Dialog'

function Harness({ closeButton = false, onClose = () => {} }: { closeButton?: boolean; onClose?: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false)
          onClose()
        }}
        closeButton={closeButton}
        aria-label="A dialog"
      >
        <p>Inside</p>
      </Dialog>
    </>
  )
}

describe('Dialog', () => {
  it('opens as a modal when open, and closes again when it goes back to false', async () => {
    const user = userEvent.setup({ delay: null })
    render(<Harness closeButton />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Open' }))
    expect(screen.getByRole('dialog', { name: 'A dialog' })).toHaveAttribute('open')

    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('calls onClose when the browser closes it, as it does on Escape', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup({ delay: null })
    render(<Harness onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: 'Open' }))

    fireEvent(screen.getByRole('dialog'), new Event('close'))
    expect(onClose).toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
  })
})
