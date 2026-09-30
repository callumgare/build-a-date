import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures'

// Things Safari has drawn differently from Chrome. The sample deck has the
// same builder as a shared one, without needing anyone to sign up.
test.use({ browserName: 'webkit' })

// The size of the first card's title and description as they're drawn on
// the screen, as a share of the card's drawn width, and how many columns of
// cards the section has. As drawn, so a browser that won't draw text below
// some size on screen (Safari in a zoomed element) shows up.
function cardText(section: Locator) {
  return section.evaluate((element) => {
    const card = element.querySelector('[data-deck-card-id]') as HTMLElement
    const width = card.getBoundingClientRect().width
    const size = (part: string) => {
      const text = document.createRange()
      text.selectNodeContents(card.querySelector(`[class*="${part}"]`) as Element)
      const box = text.getBoundingClientRect()
      return { width: (box.width / width).toFixed(2), height: (box.height / width).toFixed(2) }
    }
    const columns = [...element.querySelectorAll<HTMLElement>('[data-deck-card-id]')].filter(
      (each) => each.offsetTop === card.offsetTop,
    ).length
    return { title: size('title'), description: size('description'), columns }
  })
}

/** @see docs/card-layout.md § "Narrow screens" - the whole column shrinks */
test('in Safari, a shrunk deck has the same text and columns as the deck in use, only smaller', async ({ page }) => {
  await page.setViewportSize({ width: 860, height: 900 })
  await page.goto('/sample')
  const deck = page.getByRole('region', { name: 'Date ideas' })
  const inUse = await cardText(deck)
  expect(inUse.columns).toBeGreaterThan(1)

  await page.getByRole('button', { name: 'Show your plan' }).click()
  await expect.poll(() => deck.evaluate((element) => getComputedStyle(element).scale)).toBe('0.2')
  // And the columns' widths have finished changing too.
  await expect.poll(() => deck.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0)
  expect(await cardText(deck)).toEqual(inUse)
})

// Which rows of an element's picture, counted from its top, are mostly a
// line of light pixels: an underline, where the text itself is only ever
// broken up by the gaps between letters. The page's background is made
// plain black first.
async function underlineRows(page: Page, element: Locator) {
  await page.addStyleTag({
    content: 'canvas, [data-stars] { display: none !important } * { background: #000 !important }',
  })
  await element.scrollIntoViewIfNeeded()
  const box = await element.boundingBox()
  if (!box) throw new Error('No box')
  // Room under it, to find an underline drawn too far down.
  const picture = await page.screenshot({ clip: { x: box.x, y: box.y, width: box.width, height: box.height + 60 } })
  return page.evaluate(
    async (source) => {
      const image = new Image()
      image.src = source
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = image.width
      canvas.height = image.height
      const context = canvas.getContext('2d') as CanvasRenderingContext2D
      context.drawImage(image, 0, 0)
      const { data } = context.getImageData(0, 0, image.width, image.height)
      const rows: number[] = []
      for (let y = 0; y < image.height; y++) {
        let light = 0
        for (let x = 0; x < image.width; x++) {
          const at = (y * image.width + x) * 4
          if (data[at] + data[at + 1] + data[at + 2] > 150) light++
        }
        if (light > image.width * 0.8) rows.push(y)
      }
      return rows
    },
    `data:image/png;base64,${picture.toString('base64')}`,
  )
}

// Safari drew a see-through underline well below its text when the text had
// more than one shadow, as everything with the halo does.
test('in Safari, a link on the background has its underline just under its words', async ({ page }) => {
  await page.goto('/sample')
  const link = page.getByRole('button', { name: 'Draw random card' })
  const rows = await underlineRows(page, link)
  const box = await link.boundingBox()
  if (!box) throw new Error('No box')
  expect(rows.length).toBeGreaterThan(0)
  for (const row of rows) expect(row).toBeLessThanOrEqual(box.height)
})
