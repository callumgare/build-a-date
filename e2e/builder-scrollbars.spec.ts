import { expect, test } from './fixtures'
import { expectStill, pressOption } from './helpers'

// Scrollbars that take up room, as with a mouse plugged in or "always show
// scroll bars", rather than the headless browser's hidden ones.
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } })

/** @see docs/card-layout.md § "The plan column" - stays in the window */
for (const height of [800, 900, 1000]) {
  test(`picking a second card doesn't change the first card's width, ${height}px tall`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height })
    await page.goto('/sample')
    const stargazing = page.locator('[data-deck-card-id]').filter({ hasText: 'Stargazing' })
    await pressOption(stargazing.getByRole('button', { name: /^Add to plan: / }))
    await expect(page.locator('[data-card-id]')).toHaveCount(1)
    await expectStill(page)

    // The first card's width, and its description's height, every frame.
    await page.evaluate(() => {
      const card = document.querySelector('[data-card-id]') as HTMLElement
      const description = card.querySelector('[class*="description"]') as HTMLElement
      const seen = new Set<string>()
      ;(window as unknown as { seen: Set<string> }).seen = seen
      const until = performance.now() + 2500
      requestAnimationFrame(function watch(time) {
        seen.add(`${card.offsetWidth} wide, text ${description.offsetHeight} tall`)
        if (time < until) requestAnimationFrame(watch)
      })
    })
    const other = page.locator('[data-deck-card-id]').nth(2)
    await pressOption(other.getByRole('button', { name: /^Add to plan: / }))
    await expect(page.locator('[data-card-id]')).toHaveCount(2)
    await expectStill(page)
    expect(await page.evaluate(() => [...(window as unknown as { seen: Set<string> }).seen])).toHaveLength(1)
  })
}

/** @see docs/card-layout.md § "The plan column" - the title */
for (const layout of ['wide', 'narrow, plan in use'] as const) {
  test(`the plan's cards are in the middle, under its title (${layout})`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/sample')
    // Enough to scroll, so there's a scrollbar beside them.
    for (let picked = 1; picked <= 4; picked++) {
      await page.getByRole('button', { name: 'Draw random card' }).click()
      await expect(page.locator('[data-card-id]')).toHaveCount(picked)
    }
    if (layout !== 'wide') {
      await page.setViewportSize({ width: 860, height: 900 })
      await expect.poll(() => page.locator('[data-builder]').getAttribute('data-active')).toBe('plan')
    }
    await page.mouse.move(2, 2)
    await expectStill(page)

    const middle = (box: { x: number; width: number } | null) => (box ? box.x + box.width / 2 : Number.NaN)
    const title = middle(await page.getByRole('heading', { name: 'The Plan' }).boundingBox())
    const cards = middle(await page.locator('[data-plan-row]').first().boundingBox())
    expect(Math.abs(title - cards)).toBeLessThan(1)
  })
}

/** @see docs/card-layout.md § "The plan column" - scrolling over it: never overflow it and bring up a scrollbar for a moment */
test('picking and discarding a second card never gives the plan a scrollbar it does not need', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1400 })
  await page.goto('/sample')
  await page.getByRole('button', { name: 'Draw random card' }).click()
  await expect(page.locator('[data-card-id]')).toHaveCount(1)
  await expectStill(page)

  // Frames where the plan's column overflows, or narrows, as it would with
  // a scrollbar that takes up room (see test.use above).
  const watch = () =>
    page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          const column = document.querySelector('[data-plan-scroll]') as HTMLElement
          const width = column.clientWidth
          let bad = 0
          const until = performance.now() + 900
          requestAnimationFrame(function check(time) {
            if (column.scrollHeight > column.clientHeight || column.clientWidth !== width) bad++
            if (time < until) requestAnimationFrame(check)
            else resolve(bad)
          })
        }),
    )
  const picking = watch()
  await page.getByRole('button', { name: 'Draw random card' }).click()
  expect(await picking).toBe(0)
  await expectStill(page)
  const second = page.locator('[data-card-id]').nth(1)
  const discarding = watch()
  await pressOption(second.getByRole('button', { name: /^Discard: / }))
  expect(await discarding).toBe(0)
})

/** @see docs/card-layout.md § "Narrow screens" - the whole column shrinks: nothing in it moves round */
test("a shrunk plan is laid out the same before and after the page's script takes over", async ({ page }) => {
  await page.setViewportSize({ width: 860, height: 900 })
  // The blank slot's width on every frame, from the first the page draws.
  await page.addInitScript(() => {
    const widths: number[] = []
    ;(window as unknown as { widths: number[] }).widths = widths
    requestAnimationFrame(function watch() {
      const slot = document.querySelector('[data-plan-row] [data-empty-slot]')
      if (slot) widths.push(Math.round(slot.getBoundingClientRect().width * 10) / 10)
      if (widths.length < 120) requestAnimationFrame(watch)
    })
  })
  await page.goto('/sample')
  await expectStill(page)
  const widths = await page.evaluate(() => (window as unknown as { widths: number[] }).widths)
  expect(widths.length).toBeGreaterThan(0)
  expect(new Set(widths), widths.join(', ')).toHaveProperty('size', 1)
})
