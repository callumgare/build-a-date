// Saves a still of the galaxy background for link previews
// (docs/share-previews.md § "The background"). The background is a WebGL
// shader that only runs in a browser, so the previews use this picture of it
// instead. Run it again whenever the shader or its palette changes:
//
//   npm run dev                  # in another terminal
//   npm run og:background [http://localhost:3000]
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
await browser.close()
