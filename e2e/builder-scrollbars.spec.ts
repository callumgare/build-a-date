import { expect, test } from './fixtures'

// Scrollbars that take up room, as with a mouse plugged in or "always show
// scroll bars", rather than the headless browser's hidden ones.
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } })

/** @see docs/card-layout.md § "The plan column" - stays in the window */
for (const height of [800, 900, 1000]) {
  test(`picking a second card doesn't change the first card's width, ${height}px tall`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height })
    await page.goto('/sample')
    const stargazing = page.locator('[data-deck-card-id]').filter({ hasText: 'Stargazing' })
    await stargazing.hover()
    await stargazing.getByRole('button', { name: /^Add to plan: / }).click()
    await expect(page.locator('[data-card-id]')).toHaveCount(1)
    await page.waitForTimeout(900)

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
    await other.hover()
    await other.getByRole('button', { name: /^Add to plan: / }).click()
    await expect(page.locator('[data-card-id]')).toHaveCount(2)
    await page.waitForTimeout(1500)
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
      await expect.poll(() => page.locator('.builder').getAttribute('data-active')).toBe('plan')
    }
    await page.mouse.move(2, 2)
    await page.waitForTimeout(900)

    const middle = (box: { x: number; width: number } | null) => (box ? box.x + box.width / 2 : Number.NaN)
    const title = middle(await page.getByRole('heading', { name: 'The Plan' }).boundingBox())
    const cards = middle(await page.locator('.plan-track').first().boundingBox())
    expect(Math.abs(title - cards)).toBeLessThan(1)
  })
}
