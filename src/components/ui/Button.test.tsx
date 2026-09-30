/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Button from './Button'

vi.mock('next/link', () => import('@/test/plan-builder-mocks'))

/** @see docs/ui-components.md § "Links and buttons" */
describe('Button', () => {
  it('is a button that does nothing to a form unless asked to submit it', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup({ delay: null })
    render(<Button onClick={onClick}>Save</Button>)

    const button = screen.getByRole('button', { name: 'Save' })
    expect(button).toHaveAttribute('type', 'button')
    await user.click(button)
    expect(onClick).toHaveBeenCalled()
  })

  it('is a link when it has an href, in either look', () => {
    render(
      <>
        <Button href="/sample">Try a sample deck</Button>
        <Button variant="text" href="/sign-in">
          Sign in
        </Button>
      </>,
    )
    expect(screen.getByRole('link', { name: 'Try a sample deck' })).toHaveAttribute('href', '/sample')
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('data-variant', 'text')
  })

  it('is a plain link the browser follows itself when native', () => {
    render(
      <Button variant="text" href="/d/share1" native target="_blank" rel="noreferrer">
        Open
      </Button>,
    )
    const link = screen.getByRole('link', { name: 'Open' })
    expect(link).toHaveAttribute('href', '/d/share1')
    expect(link).toHaveAttribute('target', '_blank')
  })
})
