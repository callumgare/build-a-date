// Makes the pictures link previews are drawn with, into public/og/
// (docs/share-previews.md § "The static pictures"):
//
// - background.jpg, a still of the galaxy background. The background is a
//   WebGL shader, so the previews use this picture of it instead.
// - sample.jpg, the sample deck's preview, and default.jpg, for a deck or
//   plan whose own picture hasn't been drawn yet. Both are drawn by
//   /dev/previews, with the new still.
//
// Run it again whenever the shader, its palette or the drawing changes:
//
//   npm run dev                  # in another terminal
//   npm run og:images [http://localhost:3000]
import { writeFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const [base = 'http://localhost:3000'] = process.argv.slice(2)

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
// A preview is usually shown at a third of its size or less, which would make
// the swirls look far finer than on the site. So it's drawn zoomed in: a
// 600×315 window at 2× (the most the background paints at) makes the
// 1200×630 still, on a big screen so the swirls are drawn their biggest
// (featureScale).
const page = await browser.newPage({
  viewport: { width: 600, height: 315 },
  deviceScaleFactor: 2,
  screen: { width: 2560, height: 1440 },
  reducedMotion: 'reduce',
})
await page.goto(new URL('/', base).href)
// Everything but the background out of the way, and no sparkle.
await page.addStyleTag({
  content: 'body > :not(.galaxy-background) { display: none !important } body { min-height: 100vh }',
})
await page.waitForFunction(() => document.querySelectorAll('.galaxy-background canvas').length > 0)
// Tiles fade in as they're added (none under reduced motion, but to be safe).
await page.waitForTimeout(1000)
await page.screenshot({
  path: new URL('../public/og/background.jpg', import.meta.url).pathname,
  type: 'jpeg',
  quality: 85,
})

// The static previews, drawn by the browser the way every other one is.
const previews = await browser.newPage()
await previews.goto(new URL('/dev/previews', base).href)
await previews.waitForSelector('main[data-done="true"], [data-preview-error]', { timeout: 60_000 })
const problem = await previews.locator('[data-preview-error]').allTextContents()
if (problem.length) throw new Error(`Couldn't draw the previews: ${problem.join(' ')}`)
for (const name of ['sample', 'default']) {
  const src = await previews.locator(`img[data-preview="${name}"]`).getAttribute('src')
  if (!src) throw new Error(`/dev/previews didn't draw ${name}`)
  writeFileSync(new URL(`../public/og/${name}.jpg`, import.meta.url), Buffer.from(src.split(',')[1], 'base64'))
}
await browser.close()
