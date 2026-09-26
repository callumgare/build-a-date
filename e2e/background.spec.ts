import type { Browser, Page } from '@playwright/test'
import { expect, newVisitor, test } from './fixtures'

type Tile = {
  id: string
  /** Where it sits on the page, and where it is on screen now, in CSS pixels. */
  top: number
  screenTop: number
  cssWidth: number
  cssHeight: number
  width: number
  height: number
  ratio: number
}

// The background's tiles, each tagged so a test can tell if it's the same one later.
async function tiles(page: Page): Promise<Tile[]> {
  return page.evaluate(() => {
    // A count kept on the window, so a tile made later never reuses an id.
    const ids = window as unknown as { e2eTileIds?: number }
    return [...document.querySelectorAll<HTMLCanvasElement>('.galaxy-background canvas')].map((tile) => {
      ids.e2eTileIds ??= 0
      tile.dataset.e2eId ??= String(ids.e2eTileIds++)
      const box = tile.getBoundingClientRect()
      return {
        id: tile.dataset.e2eId,
        top: Number.parseFloat(tile.style.top),
        screenTop: box.top,
        cssWidth: box.width,
        cssHeight: box.height,
        width: tile.width,
        height: tile.height,
        ratio: window.devicePixelRatio,
      }
    })
  })
}

// Waits until tiles cover everything the window shows.
async function covered(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const tops = [...document.querySelectorAll<HTMLCanvasElement>('.galaxy-background canvas')].map((tile) =>
          Number.parseFloat(tile.style.top),
        )
        const height =
          document.querySelector<HTMLCanvasElement>('.galaxy-background canvas')?.getBoundingClientRect().height ?? 0
        if (!height) return false
        for (let y = window.scrollY; y < window.scrollY + window.innerHeight; y += height) {
          if (!tops.some((top) => top <= y && y < top + height)) return false
        }
        return true
      }),
    )
    .toBe(true)
  return tiles(page)
}

// What the tiles the window shows look like, from their pixels.
async function looks(page: Page) {
  await covered(page)
  return page.evaluate(() => {
    let red = 0
    let blue = 0
    let gold = 0
    let pixels = 0
    const pictures: string[] = []
    for (const tile of document.querySelectorAll<HTMLCanvasElement>('.galaxy-background canvas')) {
      const box = tile.getBoundingClientRect()
      if (box.bottom <= 0 || box.top >= window.innerHeight) continue
      const { data } = tile.getContext('2d')?.getImageData(0, 0, tile.width, tile.height) ?? { data: [] }
      for (let i = 0; i < data.length; i += 4) {
        red += data[i]
        blue += data[i + 2]
        if (data[i] > 128 && data[i] > data[i + 2] * 0.9) gold++
      }
      pixels += data.length / 4
      pictures.push(`${tile.style.top}:${tile.toDataURL()}`)
    }
    return { red: red / pixels, blue: blue / pixels, gold: gold / pixels, pictures: pictures.sort() }
  })
}

// Makes the page tall enough to scroll through. Only once the background is
// painted, so the page has hydrated and React won't throw the spacer away.
async function makeTall(page: Page, height: number) {
  await covered(page)
  await page.evaluate((spacer) => {
    const filler = document.createElement('div')
    filler.style.height = `${spacer}px`
    document.querySelector('.app-root')?.appendChild(filler)
  }, height)
}

async function scrollTo(page: Page, y: number) {
  await page.evaluate((top) => window.scrollTo(0, top), y)
}

/** @see docs/background.md § "How it's drawn" */
test.describe('the background at any size', () => {
  for (const [name, viewport] of [
    ['a phone', { width: 390, height: 844 }],
    ['a wide desktop', { width: 2560, height: 1080 }],
  ] as const) {
    test(`is drawn pixel for pixel on ${name}, with no stretching`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.goto('/')
      for (const tile of await covered(page)) {
        expect(tile.width).toBe(Math.round(tile.cssWidth * tile.ratio))
        expect(tile.height).toBe(Math.round(tile.cssHeight * tile.ratio))
      }
    })
  }
})

/** @see docs/background.md § "Tiles" */
test.describe('scrolling', () => {
  test('moves with the page', async ({ page }) => {
    await page.goto('/')
    await makeTall(page, 6000)
    await scrollTo(page, 3000)
    const tile = (await covered(page)).find((each) => each.top <= 3000 && 3000 < each.top + each.cssHeight)
    if (!tile) throw new Error('Nothing covers the window')
    // Its place on the page is where it is on screen plus how far down the page is.
    expect(tile.screenTop + 3000).toBeCloseTo(tile.top, 0)
    await scrollTo(page, 3100)
    const moved = (await tiles(page)).find((each) => each.id === tile.id)
    expect(moved?.screenTop).toBeCloseTo(tile.screenTop - 100, 0)
  })

  test('lets go of what it scrolled past long ago', async ({ page }) => {
    await page.goto('/')
    await makeTall(page, 30_000)
    await covered(page)
    await scrollTo(page, 25_000)
    const now = await covered(page)
    expect(now.some((tile) => tile.top === 0)).toBe(false)
    // A few screens' worth, not the whole page.
    expect(now.length).toBeLessThan(40)
  })

  test("doesn't make the page longer or wider", async ({ page }) => {
    await page.goto('/')
    await makeTall(page, 3000)
    await covered(page)
    const overflow = await page.evaluate(() => ({
      x: document.documentElement.scrollWidth - window.innerWidth,
      y: document.documentElement.scrollHeight - Math.max(document.body.offsetHeight, window.innerHeight),
    }))
    expect(overflow.x).toBeLessThanOrEqual(0)
    expect(overflow.y).toBeLessThanOrEqual(0)
  })
})

/** @see docs/background.md § "Overdrawn" */
test.describe('drawn past the window', () => {
  // A window smaller than the screen. test.use({ screen }) doesn't reach the
  // page, so it gets a context of its own.
  async function smallWindow(browser: Browser) {
    const context = await newVisitor(browser, {
      viewport: { width: 1000, height: 700 },
      screen: { width: 1920, height: 1080 },
    })
    const page = await context.newPage()
    await page.goto('/')
    return page
  }

  test('paints as wide as the screen, so a bigger window is already drawn and nothing stretches', async ({
    browser,
  }) => {
    const page = await smallWindow(browser)
    const before = await covered(page)
    expect(before[0].cssWidth).toBeGreaterThanOrEqual(1920)
    const picture = await looks(page)
    // Playwright's setViewportSize would make the screen that size too; a
    // real window grows without changing the screen.
    const devtools = await page.context().newCDPSession(page)
    await devtools.send('Emulation.setDeviceMetricsOverride', {
      width: 1800,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
      screenWidth: 1920,
      screenHeight: 1080,
    })
    const after = await covered(page)
    // The same tiles, untouched.
    expect(after.map((tile) => tile.id)).toEqual(expect.arrayContaining(before.map((tile) => tile.id)))
    expect(after[0].cssWidth).toBe(before[0].cssWidth)
    const again = await looks(page)
    expect(again.pictures).toEqual(expect.arrayContaining(picture.pictures))
  })
})

/** @see docs/background.md § "The palette" */
test('is dark blue with gold streaks, like the photo it replaced', async ({ page }) => {
  await page.setViewportSize({ width: 1080, height: 1920 })
  await page.goto('/')
  const background = await looks(page)
  expect(background.blue).toBeGreaterThan(background.red * 2)
  // Some gold, but never much: the photo is 2.5 % gold, and the shader is
  // tuned a little calmer.
  expect(background.gold).toBeGreaterThan(0.003)
  expect(background.gold).toBeLessThan(0.05)
})

/** @see docs/background.md § "The same every time" */
test('looks the same on every visit', async ({ page }) => {
  await page.goto('/')
  const first = await looks(page)
  await page.reload()
  const second = await looks(page)
  expect(second.pictures).toEqual(first.pictures)
})

/** @see docs/background.md § "Sparkle" */
test.describe('sparkle', () => {
  test('glints land on gold in the painting', async ({ page }) => {
    await page.goto('/')
    await covered(page)
    const glint = page.locator('.galaxy-glint').first()
    await expect(glint).toBeAttached({ timeout: 10_000 })
    const onGold = await glint.evaluate((element) => {
      const x = Number.parseFloat(element.style.left) + Number.parseFloat(element.style.width) / 2
      const y = Number.parseFloat(element.style.top) + Number.parseFloat(element.style.height) / 2
      const tile = [...document.querySelectorAll<HTMLCanvasElement>('.galaxy-background canvas')].find((canvas) => {
        const top = Number.parseFloat(canvas.style.top)
        return top <= y && y < top + Number.parseFloat(canvas.style.height)
      })
      if (!tile) return false
      const ratio = tile.width / Number.parseFloat(tile.style.width)
      const px = Math.round(x * ratio)
      const py = Math.round((y - Number.parseFloat(tile.style.top)) * ratio)
      // Somewhere within a CSS pixel of its centre is gold.
      const reach = Math.ceil(ratio)
      const { data } = tile.getContext('2d')?.getImageData(px - reach, py - reach, 2 * reach + 1, 2 * reach + 1) ?? {
        data: [],
      }
      for (let i = 0; i < data.length; i += 4) if (data[i] > 128 && data[i] > data[i + 2] * 0.9) return true
      return false
    })
    expect(onGold).toBe(true)
  })

  test('never paints the background again to sparkle', async ({ page }) => {
    await page.goto('/')
    const before = await covered(page)
    const picture = await looks(page)
    await page.evaluate(() => window.dispatchEvent(new Event('galaxy:celebrate')))
    await page.waitForTimeout(2500)
    const after = await tiles(page)
    expect(after.map((tile) => tile.id)).toEqual(expect.arrayContaining(before.map((tile) => tile.id)))
    expect((await looks(page)).pictures).toEqual(picture.pictures)
  })

  /** @see docs/background.md § "Bursts" */
  test('bursts into glints and a shooting star to celebrate', async ({ page }) => {
    await page.goto('/')
    await covered(page)
    await page.evaluate(() => window.dispatchEvent(new Event('galaxy:celebrate')))
    await expect(page.locator('.galaxy-shooting-star')).toHaveCount(1)
    await expect.poll(() => page.locator('.galaxy-glint').count()).toBeGreaterThan(3)
  })

  test('holds still for someone who asks for reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await covered(page)
    await page.evaluate(() => window.dispatchEvent(new Event('galaxy:celebrate')))
    await page.waitForTimeout(3000)
    await expect(page.locator('.galaxy-glint, .galaxy-shooting-star')).toHaveCount(0)
  })
})
