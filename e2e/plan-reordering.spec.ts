import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { pressOption } from './helpers'

function planOrder(page: Page) {
  return page.locator('[data-card-id]').evaluateAll((cards) => cards.map((card) => card.textContent ?? ''))
}

/** @see docs/card-layout.md § "Reordering the plan" - by dragging it, and not a click */
test('someone drags a card from anywhere on it to a new place in the plan', async ({ page }) => {
  await page.goto('/sample')
  for (const title of ['Stargazing', 'Picnic in the Park']) {
    await pressOption(page.getByRole('button', { name: `Add to plan: ${title}` }))
    await expect(page.getByRole('button', { name: `Discard: ${title}` })).toBeAttached()
  }
  const [first, second] = await planOrder(page)
  expect(first).toContain('Stargazing')
  expect(second).toContain('Picnic in the Park')

  // Picked up by its text, well away from the grip, and let go over the card,
  // which doesn't discard it.
  const stargazing = page.locator('[data-card-id]').filter({ hasText: 'Stargazing' })
  const picnic = page.locator('[data-card-id]').filter({ hasText: 'Picnic in the Park' })
  await stargazing.hover()
  await expect(page.getByRole('button', { name: 'Move Stargazing' })).toBeVisible()
  const cardBox = await stargazing.boundingBox()
  const picnicBox = await picnic.boundingBox()
  if (!cardBox || !picnicBox) throw new Error('Cards have no size')
  // Down the plan's column, past the card under it.
  const x = cardBox.x + cardBox.width * 0.25
  await page.mouse.move(x, cardBox.y + cardBox.height * 0.5)
  await page.mouse.down()
  await page.mouse.move(x, picnicBox.y + picnicBox.height * 0.9, { steps: 20 })
  await page.mouse.up()

  await expect.poll(async () => (await planOrder(page))[0]).toContain('Picnic in the Park')
  await expect(page.getByRole('button', { name: 'Discard: Stargazing' })).toBeAttached()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe('')

  // Kept in the browser, so a reload keeps the new order.
  await page.reload()
  await expect.poll(async () => (await planOrder(page))[0]).toContain('Picnic in the Park')
})

/** @see docs/card-layout.md § "Reordering the plan" - by dragging it */
test('a card dragged over another card takes its place, from any part of it', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1600 })
  await page.goto('/sample')
  const labels = await page
    .locator('[data-deck-card-id]')
    .evaluateAll((cards) => cards.slice(0, 3).map((card) => card.querySelector('button')?.ariaLabel ?? ''))
  const titles = labels.map((label) => label.replace(/^Add to plan: /, ''))
  for (const title of titles) {
    await pressOption(page.getByRole('button', { name: `Add to plan: ${title}` }))
    await expect(page.getByRole('button', { name: `Discard: ${title}` })).toBeAttached()
  }
  const [a, b, c] = titles
  const titleOrder = async () => {
    const order = await planOrder(page)
    return order.map((text) => titles.find((title) => text.includes(title)))
  }
  expect(await titleOrder()).toEqual([a, b, c])

  // Picked up by its middle and let go just inside the card's far edge, where
  // the dragged card's own middle hasn't reached the other card's middle.
  async function drag(title: string, onto: string, fraction: number) {
    const card = page.locator('[data-card-id]').filter({ hasText: title })
    const other = page.locator('[data-card-id]').filter({ hasText: onto })
    await card.hover()
    const box = await card.boundingBox()
    const otherBox = await other.boundingBox()
    if (!box || !otherBox) throw new Error('Cards have no size')
    const x = box.x + box.width * 0.25
    await page.mouse.move(x, box.y + box.height * 0.5)
    await page.mouse.down()
    await page.mouse.move(x, otherBox.y + otherBox.height * fraction, { steps: 20 })
    await page.mouse.up()
    // Settled into its place, after which the next drag can start.
    await expect(page.locator('[data-card-id][class*="lifted"]')).toHaveCount(0)
  }

  // Up, onto the bottom of the card above.
  await drag(c, b, 0.85)
  await expect.poll(titleOrder).toEqual([a, c, b])
  // Down, onto the top of the card below.
  await drag(a, c, 0.15)
  await expect.poll(titleOrder).toEqual([c, a, b])
})

/** @see docs/card-layout.md § "Reordering the plan" - by dragging it */
test("the dragged card keeps its options, and the faded card where it'll land never shows them", async ({ page }) => {
  await page.goto('/sample')
  for (const title of ['Stargazing', 'Picnic in the Park']) {
    await pressOption(page.getByRole('button', { name: `Add to plan: ${title}` }))
    await expect(page.getByRole('button', { name: `Discard: ${title}` })).toBeAttached()
  }

  const card = page.locator('[data-card-id]').filter({ hasText: 'Stargazing' })
  await card.hover()
  await expect(page.getByRole('button', { name: 'Move Stargazing' })).toBeVisible()
  const box = await card.boundingBox()
  if (!box) throw new Error('Card has no size')
  // Moved only a little, so the pointer is still over the faded card.
  const x = box.x + box.width * 0.25
  await page.mouse.move(x, box.y + box.height * 0.5)
  await page.mouse.down()
  await page.mouse.move(x + 10, box.y + box.height * 0.5 + 10, { steps: 5 })

  const opacities = (selector: string) =>
    page
      .locator(selector)
      .evaluateAll((elements) =>
        elements.flatMap((element) =>
          [...element.querySelectorAll('[class*="actions"], [class*="grip"]')].map(
            (part) => getComputedStyle(part).opacity,
          ),
        ),
      )
  await expect.poll(() => opacities('[data-card-id][class*="lifted"]')).toEqual(['0', '0'])
  await expect.poll(() => opacities('[class*="dragging"]')).toEqual(['1', '1'])
  await expect(page.locator('[class*="dragging"]').getByText('Discard')).toBeVisible()

  await page.mouse.up()
})

// Records, every frame until stopped, the highest opacity of the options on
// the cards the selector picks out.
async function watchOptions(page: Page, selector: string) {
  await page.evaluate((selector) => {
    const record = window as unknown as { optionOpacities: number[]; stopWatching: boolean }
    record.optionOpacities = []
    record.stopWatching = false
    function tick() {
      const opacities = [...document.querySelectorAll(selector)].map((element) =>
        Number(getComputedStyle(element).opacity),
      )
      record.optionOpacities.push(Math.max(0, ...opacities))
      if (!record.stopWatching) requestAnimationFrame(tick)
    }
    tick()
  }, selector)
  return () =>
    page.evaluate(() => {
      const record = window as unknown as { optionOpacities: number[]; stopWatching: boolean }
      record.stopWatching = true
      return record.optionOpacities
    })
}

async function pickTwo(page: Page) {
  for (const title of ['Stargazing', 'Picnic in the Park']) {
    await pressOption(page.getByRole('button', { name: `Add to plan: ${title}` }))
    await expect(page.getByRole('button', { name: `Discard: ${title}` })).toBeAttached()
  }
}

/** @see docs/card-layout.md § "Reordering the plan" - by dragging it */
test("the other cards don't show their options while a card is dragged over them", async ({ page }) => {
  await page.goto('/sample')
  await pickTwo(page)

  const card = page.locator('[data-card-id]').filter({ hasText: 'Picnic in the Park' })
  const other = page.locator('[data-card-id]').filter({ hasText: 'Stargazing' })
  await card.hover()
  const box = await card.boundingBox()
  const otherBox = await other.boundingBox()
  if (!box || !otherBox) throw new Error('Cards have no size')
  const x = box.x + box.width * 0.25
  await page.mouse.move(x, box.y + box.height * 0.5)
  await page.mouse.down()
  await page.mouse.move(x, box.y + box.height * 0.4, { steps: 3 })
  // Up over the other card, which slides down under the pointer, and on up
  // to its top.
  const stop = await watchOptions(page, '[data-card-id]:not([class*="lifted"]) [class*="actions"]')
  await page.mouse.move(x, otherBox.y + 5, { steps: 40 })
  await page.waitForTimeout(500)
  expect(Math.max(...(await stop()))).toBe(0)
  await page.mouse.up()
})

/** @see docs/card-layout.md § "Reordering the plan" - by dragging it */
test('a card let go with the mouse over it keeps showing its options throughout', async ({ page }) => {
  await page.goto('/sample')
  await pickTwo(page)

  const card = page.locator('[data-card-id]').filter({ hasText: 'Picnic in the Park' })
  const other = page.locator('[data-card-id]').filter({ hasText: 'Stargazing' })
  await card.hover()
  const id = await card.getAttribute('data-card-id')
  const box = await card.boundingBox()
  const otherBox = await other.boundingBox()
  if (!box || !otherBox) throw new Error('Cards have no size')
  const x = box.x + box.width * 0.25
  await page.mouse.move(x, box.y + box.height * 0.5)
  await page.mouse.down()
  await page.mouse.move(x, otherBox.y + otherBox.height * 0.5, { steps: 20 })
  await expect.poll(async () => (await planOrder(page))[0]).toContain('Picnic in the Park')

  // On the stand-in, then on the card once it has settled, without a frame
  // between where neither shows them.
  const stop = await watchOptions(
    page,
    `[class*="dragging"] [class*="actions"], [data-card-id="${id}"] [class*="actions"]`,
  )
  await page.mouse.up()
  await expect(page.locator('[data-card-id][class*="lifted"]')).toHaveCount(0)
  await page.waitForTimeout(300)
  expect(Math.min(...(await stop()))).toBe(1)

  // Until the mouse leaves it.
  await page.mouse.move(5, 5)
  await expect
    .poll(() => card.locator('[class*="actions"]').evaluate((element) => getComputedStyle(element).opacity))
    .toBe('0')
})

/** @see docs/card-layout.md § "Reordering the plan" - by dragging it */
test('a press on a card in the plan that does not move still discards it', async ({ page }) => {
  await page.goto('/sample')
  await pressOption(page.getByRole('button', { name: 'Add to plan: Stargazing' }))
  const card = page.locator('[data-card-id]').filter({ hasText: 'Stargazing' })
  const box = await card.boundingBox()
  if (!box) throw new Error('Card has no size')
  await card.click({ position: { x: box.width * 0.25, y: box.height * 0.5 } })
  await expect(page.locator('[data-card-id]')).toHaveCount(0)
})

/** @see docs/card-layout.md § "Reordering the plan" - not a click */
test("letting go of a drag doesn't do the option on that side of the card", async ({ page }) => {
  await page.goto('/sample')
  for (const title of ['Stargazing', 'Picnic in the Park']) {
    await pressOption(page.getByRole('button', { name: `Add to plan: ${title}` }))
    await expect(page.getByRole('button', { name: `Discard: ${title}` })).toBeAttached()
  }

  // Dragged up, once by the right half, where a click opens the notes, then
  // by the left half, where a click discards the card.
  for (const side of [0.75, 0.25]) {
    const [, secondTitle] = await planOrder(page)
    const card = page.locator('[data-card-id]').nth(1)
    const other = page.locator('[data-card-id]').first()
    await card.hover()
    await expect(card.getByRole('button', { name: /^Move / })).toBeVisible()
    const box = await card.boundingBox()
    const otherBox = await other.boundingBox()
    if (!box || !otherBox) throw new Error('Cards have no size')
    const x = box.x + box.width * side
    await page.mouse.move(x, box.y + box.height * 0.5)
    await page.mouse.down()
    await page.mouse.move(x, otherBox.y + 10, { steps: 20 })
    await page.mouse.up()

    await expect.poll(async () => (await planOrder(page))[0]).toBe(secondTitle)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.locator('[data-card-id]')).toHaveCount(2)
  }
})

/** @see docs/card-layout.md § "Reordering the plan" - scrolls with the drag */
for (const end of ['bottom', 'top'] as const) {
  test(`dragging a card up to the ${end} of a plan that scrolls scrolls it`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/sample')
    const titles = await page
      .locator('[data-deck-card-id]')
      .evaluateAll((cards) => cards.slice(0, 4).map((card) => card.querySelector('button')?.ariaLabel ?? ''))
    for (const label of titles) {
      const title = label.replace(/^Add to plan: /, '')
      await pressOption(page.getByRole('button', { name: label }))
      await expect(page.getByRole('button', { name: `Discard: ${title}` })).toBeAttached()
    }

    // The page scrolled down until the plan's column stays put at the top of
    // the window, and the column scrolled all the way away from the end the
    // card is taken to.
    const column = page.locator('[data-plan-scroll]')
    const scrollTop = () => column.evaluate((element) => element.scrollTop)
    const furthest = await column.evaluate((element, end) => {
      window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY)
      element.scrollTop = end === 'bottom' ? 0 : element.scrollHeight
      return element.scrollTop
    }, end)
    expect(await column.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true)
    const columnBox = await column.boundingBox()
    const cards = page.locator('[data-card-id]')
    const card = end === 'bottom' ? cards.first() : cards.last()
    await card.hover()
    const box = await card.boundingBox()
    if (!columnBox || !box) throw new Error('Plan has no size')
    const x = box.x + box.width * 0.5
    await page.mouse.move(x, box.y + box.height * 0.5)
    await page.mouse.down()
    await page.mouse.move(x, end === 'bottom' ? columnBox.y + columnBox.height - 10 : columnBox.y + 10, {
      steps: 20,
    })

    // Held still at the end, it keeps going.
    if (end === 'bottom') await expect.poll(scrollTop).toBeGreaterThan(furthest + 100)
    else await expect.poll(scrollTop).toBeLessThan(furthest - 100)
    await page.mouse.up()
  })
}

/** @see docs/card-layout.md § "Reordering the plan" - scrolls with the drag: while that end of the column is out of the window, the page scrolls instead */
test("dragging a card down while the plan's bottom is below the window scrolls the page", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/sample')
  await pickTwo(page)

  // At the top of the page, where the column hasn't stuck to the top of the
  // window yet, so it runs on below the window.
  await page.evaluate(() => window.scrollTo(0, 0))
  const columnBox = await page.locator('[data-column="plan"]').boundingBox()
  if (!columnBox) throw new Error('Plan has no size')
  expect(columnBox.y + columnBox.height).toBeGreaterThan(800)

  const card = page.locator('[data-card-id]').first()
  await card.hover()
  const box = await card.boundingBox()
  if (!box) throw new Error('Card has no size')
  const x = box.x + box.width * 0.5
  await page.mouse.move(x, box.y + box.height * 0.5)
  await page.mouse.down()
  // Down to the bottom of the window, and held there.
  await page.mouse.move(x, 795, { steps: 20 })
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100)
  await page.mouse.up()
})
