/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ErrorPage from './error'

describe('ErrorPage', () => {
  it('explains the page failed and links home', () => {
    render(<ErrorPage error={new Error('Failed to get session')} retry={() => {}} />)
    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to Build-a-Date' })).toHaveAttribute('href', '/')
  })

  it('retries the page when asked', async () => {
    const retry = vi.fn()
    render(<ErrorPage error={new Error('Failed to get session')} retry={retry} />)
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(retry).toHaveBeenCalledOnce()
  })
})
