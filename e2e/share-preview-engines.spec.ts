import { chromium, firefox, webkit } from '@playwright/test'
import { expect, test } from './fixtures'

// Every browser draws link previews its own way: Safari has had trouble with
// SVGs that hold pictures, and Firefox drew the first picture it was asked
// for without its cards' frames (docs/share-previews.md § "Drawing in the
// browser"). So /dev/previews draws the sample deck in each, and the frame
// of its first card is looked for: on the paper, the frame's lines are
// darker.
for (const engine of [chromium, firefox, webkit]) {
  /** @see docs/share-previews.md § "The cards" - each card with its frame */
  test(`${engine.name()} draws the cards' frames`, async ({ baseURL }) => {
    const browser = await engine.launch()
    const page = await browser.newPage({ baseURL })
    await page.goto('/dev/previews')
    await page.waitForSelector('main[data-done="true"], [data-preview-error]', { timeout: 60_000 })
    expect(await page.locator('[data-preview-error]').allTextContents()).toEqual([])

    const brightness = await page.evaluate(async () => {
      const picture = document.querySelector<HTMLImageElement>('img[data-preview="sample"]')
      if (!picture) throw new Error('No sample picture')
      await picture.decode()
      const canvas = document.createElement('canvas')
      canvas.width = 1200
      canvas.height = 630
      const context = canvas.getContext('2d')
      if (!context) throw new Error('No canvas')
      context.drawImage(picture, 0, 0, 1200, 630)
      // Across the first card's left edge, below its top piece: paper, then its rails.
      const row = context.getImageData(52, 320, 24, 1).data
      return Array.from({ length: 24 }, (_, index) => (row[index * 4] + row[index * 4 + 1] + row[index * 4 + 2]) / 3)
    })
    expect(Math.max(...brightness)).toBeGreaterThan(225)
    expect(Math.min(...brightness.slice(4))).toBeLessThan(190)
    await browser.close()
  })
}
