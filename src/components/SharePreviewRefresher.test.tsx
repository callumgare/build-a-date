/** @vitest-environment jsdom */
import { act, render } from '@testing-library/react'
import type { PreviewInput } from '@/lib/og/preview'
import { previewKey } from '@/lib/og/preview-key'
import SharePreviewRefresher, { REFRESH_DELAY } from './SharePreviewRefresher'

const { drawPreview } = vi.hoisted(() => ({ drawPreview: vi.fn() }))
vi.mock('@/lib/og/client', () => ({ drawPreview }))
const { saveDeckPreview } = vi.hoisted(() => ({ saveDeckPreview: vi.fn() }))
vi.mock('@/lib/actions/decks', () => ({ saveDeckPreview }))
const { savePlanPreview } = vi.hoisted(() => ({ savePlanPreview: vi.fn() }))
vi.mock('@/lib/actions/plans', () => ({ savePlanPreview }))

const input: PreviewInput = { title: 'Weekend', cards: [{ id: 'picnic', title: 'Picnic' }], layout: 'grid' }
const drawn = { key: previewKey(input), image: new Blob(['jpeg']) }

// Lets the wait run out, then the drawing and sending finish.
async function settle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(REFRESH_DELAY)
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  drawPreview.mockReset().mockResolvedValue(drawn)
  saveDeckPreview.mockReset().mockResolvedValue({ ok: true, data: undefined })
  savePlanPreview.mockReset().mockResolvedValue({ ok: true, data: undefined })
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
})

/** @see docs/share-previews.md § "When it's drawn" */
describe('SharePreviewRefresher', () => {
  it("draws and sends the picture when there isn't one yet", async () => {
    render(<SharePreviewRefresher kind="deck" id="deck1" input={input} stored={null} />)
    expect(drawPreview).not.toHaveBeenCalled()
    await settle()
    expect(drawPreview).toHaveBeenCalledWith(input, expect.any(Number))
    expect(saveDeckPreview).toHaveBeenCalledWith('deck1', drawn)
  })

  it('sends a plan’s picture as the plan’s', async () => {
    render(<SharePreviewRefresher kind="plan" id="plan1" input={{ ...input, layout: 'fan' }} stored="old" />)
    await settle()
    expect(savePlanPreview).toHaveBeenCalledWith('plan1', drawn)
    expect(saveDeckPreview).not.toHaveBeenCalled()
  })

  it('leaves a picture that is up to date alone', async () => {
    render(<SharePreviewRefresher kind="deck" id="deck1" input={input} stored={previewKey(input)} />)
    await settle()
    expect(drawPreview).not.toHaveBeenCalled()
  })

  it('draws once for a run of quick changes, and again for each change after that', async () => {
    const { rerender } = render(<SharePreviewRefresher kind="deck" id="deck1" input={input} stored={null} />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(REFRESH_DELAY / 2)
    })
    const renamed = { ...input, title: 'Weekends' }
    rerender(<SharePreviewRefresher kind="deck" id="deck1" input={renamed} stored={null} />)
    // The same picture again, as a page refresh hands it over, doesn't start again.
    rerender(<SharePreviewRefresher kind="deck" id="deck1" input={{ ...renamed }} stored={null} />)
    await settle()
    expect(drawPreview).toHaveBeenCalledExactlyOnceWith(renamed, expect.any(Number))

    const moreCards = { ...renamed, cards: [...renamed.cards, { id: 'hike', title: 'Hike' }] }
    rerender(<SharePreviewRefresher kind="deck" id="deck1" input={moreCards} stored={previewKey(renamed)} />)
    await settle()
    expect(drawPreview).toHaveBeenLastCalledWith(moreCards, expect.any(Number))
  })

  it('shrugs off a picture it can’t draw or that isn’t kept', async () => {
    drawPreview.mockRejectedValueOnce(new Error('No canvas'))
    const { rerender } = render(<SharePreviewRefresher kind="deck" id="deck1" input={input} stored={null} />)
    await settle()
    expect(saveDeckPreview).not.toHaveBeenCalled()

    saveDeckPreview.mockResolvedValue({ ok: false, error: 'The picture is out of date' })
    rerender(<SharePreviewRefresher kind="deck" id="deck1" input={{ ...input, title: 'Other' }} stored={null} />)
    await settle()
    expect(console.warn).toHaveBeenCalledWith("The link preview wasn't kept: The picture is out of date")
  })
})
