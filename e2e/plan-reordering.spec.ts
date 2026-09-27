import type { Page } from '@playwright/test'
import { expect, newVisitor, test } from './fixtures'
import { createDeck, signUp } from './helpers'

function planOrder(page: Page) {
  return page.locator('[data-card-id]').evaluateAll((cards) => cards.map((card) => card.textContent ?? ''))
}

/** @see docs/card-layout.md § "Reordering the plan" - by dragging it, and not a click */
test('someone drags a card from anywhere on it to a new place in the plan', async ({ page, browser, request }) => {
  await signUp(page, request, 'Alex')
  const shareUrl = await createDeck(page, 'Ideas for Sam')

  const guestContext = await newVisitor(browser)
  const guest = await guestContext.newPage()
  await guest.goto(shareUrl)
  for (const title of ['Stargazing', 'Picnic in the Park']) {
    await guest.locator('[data-deck-card-id]').filter({ hasText: title }).hover()
    await guest.getByRole('button', { name: `Add to plan: ${title}` }).click()
    await expect(guest.getByRole('button', { name: `Discard: ${title}` })).toBeAttached()
  }
  const [first, second] = await planOrder(guest)
  expect(first).toContain('Stargazing')
  expect(second).toContain('Picnic in the Park')

  // Picked up by its text, well away from the grip, and let go over the card,
  // which doesn't discard it.
  const stargazing = guest.locator('[data-card-id]').filter({ hasText: 'Stargazing' })
  const picnic = guest.locator('[data-card-id]').filter({ hasText: 'Picnic in the Park' })
  await stargazing.hover()
  await expect(guest.getByRole('button', { name: 'Move Stargazing' })).toBeVisible()
  const cardBox = await stargazing.boundingBox()
  const picnicBox = await picnic.boundingBox()
  if (!cardBox || !picnicBox) throw new Error('Cards have no size')
  // Down the plan's column, past the card under it.
  const x = cardBox.x + cardBox.width * 0.25
  await guest.mouse.move(x, cardBox.y + cardBox.height * 0.5)
  await guest.mouse.down()
  await guest.mouse.move(x, picnicBox.y + picnicBox.height * 0.9, { steps: 20 })
  await guest.mouse.up()

  await expect.poll(async () => (await planOrder(guest))[0]).toContain('Picnic in the Park')
  await expect(guest.getByRole('button', { name: 'Discard: Stargazing' })).toBeAttached()
  await expect(guest.getByRole('dialog')).toHaveCount(0)
  expect(await guest.evaluate(() => window.getSelection()?.toString())).toBe('')

  // Kept in the browser, so a reload keeps the new order.
  await guest.reload()
  await expect.poll(async () => (await planOrder(guest))[0]).toContain('Picnic in the Park')

  await guestContext.close()
})

/** @see docs/card-layout.md § "Reordering the plan" - by dragging it */
test('a press on a card in the plan that does not move still discards it', async ({ page, browser, request }) => {
  await signUp(page, request, 'Alex')
  const shareUrl = await createDeck(page, 'Ideas for Sam')

  const guestContext = await newVisitor(browser)
  const guest = await guestContext.newPage()
  await guest.goto(shareUrl)
  await guest.locator('[data-deck-card-id]').filter({ hasText: 'Stargazing' }).hover()
  await guest.getByRole('button', { name: 'Add to plan: Stargazing' }).click()
  const card = guest.locator('[data-card-id]').filter({ hasText: 'Stargazing' })
  const box = await card.boundingBox()
  if (!box) throw new Error('Card has no size')
  await card.click({ position: { x: box.width * 0.25, y: box.height * 0.5 } })
  await expect(guest.locator('[data-card-id]')).toHaveCount(0)

  await guestContext.close()
})

/** @see docs/card-layout.md § "Reordering the plan" - not a click */
test("letting go of a drag doesn't do the option on that side of the card", async ({ page, browser, request }) => {
  await signUp(page, request, 'Alex')
  const shareUrl = await createDeck(page, 'Ideas for Sam')

  const guestContext = await newVisitor(browser)
  const guest = await guestContext.newPage()
  await guest.goto(shareUrl)
  for (const title of ['Stargazing', 'Picnic in the Park']) {
    await guest.locator('[data-deck-card-id]').filter({ hasText: title }).hover()
    await guest.getByRole('button', { name: `Add to plan: ${title}` }).click()
    await expect(guest.getByRole('button', { name: `Discard: ${title}` })).toBeAttached()
  }

  // Dragged up, once by the right half, where a click opens the notes, then
  // by the left half, where a click discards the card.
  for (const side of [0.75, 0.25]) {
    const [, secondTitle] = await planOrder(guest)
    const card = guest.locator('[data-card-id]').nth(1)
    const other = guest.locator('[data-card-id]').first()
    await card.hover()
    await expect(card.getByRole('button', { name: /^Move / })).toBeVisible()
    const box = await card.boundingBox()
    const otherBox = await other.boundingBox()
    if (!box || !otherBox) throw new Error('Cards have no size')
    const x = box.x + box.width * side
    await guest.mouse.move(x, box.y + box.height * 0.5)
    await guest.mouse.down()
    await guest.mouse.move(x, otherBox.y + 10, { steps: 20 })
    await guest.mouse.up()

    await expect.poll(async () => (await planOrder(guest))[0]).toBe(secondTitle)
    await expect(guest.getByRole('dialog')).toHaveCount(0)
    await expect(guest.locator('[data-card-id]')).toHaveCount(2)
  }

  await guestContext.close()
})

/** @see docs/card-layout.md § "Reordering the plan" - scrolls with the drag */
for (const end of ['bottom', 'top'] as const) {
  test(`dragging a card up to the ${end} of a plan that scrolls scrolls it`, async ({ page, browser, request }) => {
    await signUp(page, request, 'Alex')
    const shareUrl = await createDeck(page, 'Ideas for Sam')

    const guestContext = await newVisitor(browser)
    const guest = await guestContext.newPage()
    await guest.setViewportSize({ width: 1280, height: 800 })
    await guest.goto(shareUrl)
    const titles = await guest
      .locator('[data-deck-card-id]')
      .evaluateAll((cards) => cards.slice(0, 4).map((card) => card.querySelector('button')?.ariaLabel ?? ''))
    for (const label of titles) {
      const title = label.replace(/^Add to plan: /, '')
      await guest.locator('[data-deck-card-id]').filter({ hasText: title }).hover()
      await guest.getByRole('button', { name: label }).click()
      await expect(guest.getByRole('button', { name: `Discard: ${title}` })).toBeAttached()
    }

    // The page scrolled down until the plan's column stays put at the top of
    // the window, and the column scrolled all the way away from the end the
    // card is taken to.
    const column = guest.locator('.plan-scroll')
    const scrollTop = () => column.evaluate((element) => element.scrollTop)
    const furthest = await column.evaluate((element, end) => {
      window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY)
      element.scrollTop = end === 'bottom' ? 0 : element.scrollHeight
      return element.scrollTop
    }, end)
    expect(await column.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true)
    const columnBox = await column.boundingBox()
    const cards = guest.locator('[data-card-id]')
    const card = end === 'bottom' ? cards.first() : cards.last()
    await card.hover()
    const box = await card.boundingBox()
    if (!columnBox || !box) throw new Error('Plan has no size')
    const x = box.x + box.width * 0.5
    await guest.mouse.move(x, box.y + box.height * 0.5)
    await guest.mouse.down()
    await guest.mouse.move(x, end === 'bottom' ? columnBox.y + columnBox.height - 10 : columnBox.y + 10, {
      steps: 20,
    })

    // Held still at the end, it keeps going.
    if (end === 'bottom') await expect.poll(scrollTop).toBeGreaterThan(furthest + 100)
    else await expect.poll(scrollTop).toBeLessThan(furthest - 100)
    await guest.mouse.up()

    await guestContext.close()
  })
}
