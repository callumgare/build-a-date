/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Chip, ChipGroup } from './Chip'

describe('ChipGroup and Chip', () => {
  it('names the group for screen readers, and says whether each chip is on', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup({ delay: null })
    render(
      <ChipGroup name="Filter ideas" label="Show">
        <Chip pressed onClick={onClick}>
          All
        </Chip>
        <Chip pressed={false} onClick={onClick}>
          outside
        </Chip>
      </ChipGroup>,
    )

    expect(screen.getByRole('group', { name: 'Filter ideas' })).toHaveTextContent('Show')
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'outside' })).toHaveAttribute('aria-pressed', 'false')
    await user.click(screen.getByRole('button', { name: 'outside' }))
    expect(onClick).toHaveBeenCalled()
  })
})
