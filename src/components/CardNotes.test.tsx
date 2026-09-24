/** @vitest-environment jsdom */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DateCard } from '@/types'
import CardNotes from './CardNotes'
import { frameFor } from './frames'

const { saveCardNotes } = vi.hoisted(() => ({ saveCardNotes: vi.fn() }))
vi.mock('@/lib/actions/plans', () => ({ saveCardNotes }))

const card: DateCard = { id: 'museum', title: 'Museum', description: '', tags: [] }

function renderNotes({ reduceMotion = true, onClosed = vi.fn() } = {}) {
  render(
    <CardNotes
      card={card}
      frame={frameFor(card.id)}
      shareId="share123"
      initial={{ interest: null, notes: '' }}
      from={new DOMRect(0, 0, 200, 266)}
      returnTo={() => null}
      reduceMotion={reduceMotion}
      onChange={() => {}}
      onClosed={onClosed}
    />,
  )
  return { dialog: screen.getByRole('dialog', { name: 'Museum' }), onClosed }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

const saved = { ok: true, data: undefined }

beforeEach(() => {
  saveCardNotes.mockReset()
  saveCardNotes.mockResolvedValue(saved)
})

describe('CardNotes', () => {
  describe('saving', () => {
    afterEach(() => vi.useRealTimers())

    // Driven by hand rather than userEvent, which waits on timers that are faked here.
    function typeNotes(dialog: HTMLElement, text: string) {
      const box = within(dialog).getByRole('textbox', { name: 'Notes' })
      act(() => box.focus())
      fireEvent.change(box, { target: { value: text } })
      return box
    }

    /** @see docs/card-notes.md § "Saving" - notes also save when the box loses focus */
    it('saves notes as soon as the box loses focus, as one save', async () => {
      vi.useFakeTimers()
      const { dialog } = renderNotes()

      const box = typeNotes(dialog, 'Free on Sundays')
      expect(saveCardNotes).not.toHaveBeenCalled()
      await act(async () => box.blur())
      expect(saveCardNotes).toHaveBeenCalledWith('share123', 'museum', { interest: null, notes: 'Free on Sundays' })

      await act(async () => vi.advanceTimersByTime(1000))
      expect(saveCardNotes).toHaveBeenCalledTimes(1)
    })

    /** @see docs/card-notes.md § "Saving" - notes also save when the page is left */
    it('saves notes that are still waiting when the page is left', async () => {
      vi.useFakeTimers()
      const { dialog } = renderNotes()

      typeNotes(dialog, 'Early start')
      expect(saveCardNotes).not.toHaveBeenCalled()
      await act(async () => window.dispatchEvent(new Event('pagehide')))
      expect(saveCardNotes).toHaveBeenCalledWith('share123', 'museum', { interest: null, notes: 'Early start' })

      await act(async () => vi.advanceTimersByTime(1000))
      expect(saveCardNotes).toHaveBeenCalledTimes(1)
    })

    /** @see docs/card-notes.md § "Saving" - saves go one at a time, in order */
    it("doesn't start a save until the one before it has finished", async () => {
      const first = deferred<typeof saved>()
      saveCardNotes.mockReturnValueOnce(first.promise)
      const user = userEvent.setup()
      const { dialog } = renderNotes()

      await user.click(within(dialog).getByRole('radio', { name: '3 stars' }))
      await user.click(within(dialog).getByRole('radio', { name: '4 stars' }))
      expect(saveCardNotes).toHaveBeenCalledTimes(1)

      first.resolve(saved)
      await waitFor(() => expect(saveCardNotes).toHaveBeenCalledTimes(2))
      expect(saveCardNotes.mock.calls).toEqual([
        ['share123', 'museum', { interest: 3, notes: '' }],
        ['share123', 'museum', { interest: 4, notes: '' }],
      ])
    })

    /** @see docs/card-notes.md § "Saving" - it shows Saving…, then Saved */
    it('shows Saving… while a save is going, then Saved', async () => {
      const save = deferred<typeof saved>()
      saveCardNotes.mockReturnValueOnce(save.promise)
      const user = userEvent.setup()
      const { dialog } = renderNotes()

      await user.click(within(dialog).getByRole('radio', { name: '2 stars' }))
      expect(within(dialog).getByRole('status')).toHaveTextContent('Saving…')

      save.resolve(saved)
      await waitFor(() => expect(within(dialog).getByRole('status')).toHaveTextContent('Saved'))
    })

    /** @see docs/card-notes.md § "Saving" - if a save fails, it shows why */
    it("says the save didn't work when it can't reach the server", async () => {
      saveCardNotes.mockRejectedValue(new Error('Failed to fetch'))
      const user = userEvent.setup()
      const { dialog } = renderNotes()

      await user.click(within(dialog).getByRole('radio', { name: '2 stars' }))
      expect(await within(dialog).findByRole('alert')).toHaveTextContent(
        "Couldn't save. Check your connection and try again.",
      )
    })
  })

  /** @see docs/card-notes.md § "Opening a card's notes" - a click beside the card flips it back */
  describe('closing', () => {
    it('closes on a click beside the card', () => {
      const { dialog, onClosed } = renderNotes()
      fireEvent.click(dialog)
      expect(onClosed).toHaveBeenCalledTimes(1)
    })

    it('stays open on a click on the card', () => {
      const { dialog, onClosed } = renderNotes()
      fireEvent.click(within(dialog).getByRole('heading', { name: 'Museum' }))
      fireEvent.click(within(dialog).getByRole('textbox', { name: 'Notes' }))
      expect(onClosed).not.toHaveBeenCalled()
    })
  })

  /** @see docs/card-notes.md § "Opening a card's notes" - with reduced motion it opens without the flip */
  it('opens straight onto the back of the card with reduced motion', () => {
    const { dialog } = renderNotes({ reduceMotion: true })
    const flipper = within(dialog).getByRole('heading', { name: 'Museum' }).parentElement?.parentElement
    expect(flipper?.style.transform).toMatch(/rotateY\(180deg\)/)
    expect(flipper?.style.transform).not.toMatch(/translate|scale/)
  })
})
