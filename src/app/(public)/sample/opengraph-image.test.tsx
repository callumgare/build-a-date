import { sampleDeck } from '@/data/sample-deck'
import { renderShareImage } from '@/lib/og/render'
import { pngSize } from '@/test/png'
import Image from './opengraph-image'

vi.mock('@opennextjs/cloudflare', () => import('@/test/cloudflare'))
vi.mock('@/lib/og/render', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/og/render')>()
  return { ...original, renderShareImage: vi.fn(original.renderShareImage) }
})

/** @see docs/share-previews.md § "A deck" - the sample deck gets the same picture */
it("draws the sample deck's link preview as a shared deck's", async () => {
  const response = await Image()
  expect(renderShareImage).toHaveBeenCalledWith({ title: 'Sample Deck', cards: sampleDeck.cards, layout: 'grid' })
  expect(await pngSize(response)).toEqual({ width: 1200, height: 630 })
})
