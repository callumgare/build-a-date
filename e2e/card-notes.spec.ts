import type { Locator, Page } from '@playwright/test'
import { expect, newVisitor, test } from './fixtures'
import { closeShareDialog, createDeck, signUp } from './helpers'

/** @see docs/card-notes.md § "Who can change them" */
test('someone with the link rates an idea and leaves notes the owner can see', async ({ page, browser, request }) => {
  const consoleErrors: string[] = []
  await signUp(page, request, 'Alex')
  const shareUrl = await createDeck(page, 'Ideas for Sam')

  // Someone without an account opens the link.
  const guestContext = await newVisitor(browser)
  const guest = await guestContext.newPage()
  guest.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  await guest.goto(shareUrl)
  const card = guest.locator('[data-deck-card-id]').filter({ hasText: 'Stargazing' })

  // docs/card-notes.md § "Clicking a side of the card" - the right half opens the notes.
  const box = await card.boundingBox()
  if (!box) throw new Error('Card has no size')
  await card.click({ position: { x: box.width * 0.75, y: box.height * 0.7 } })
  await expect(guest.getByRole('button', { name: 'Discard: Stargazing' })).toHaveCount(0)
  const notes = guest.getByRole('dialog', { name: 'Stargazing' })
  await expect(notes).toBeVisible()
  await notes.getByRole('radio', { name: '4 stars' }).locator('..').click()
  await expect(notes.getByRole('status')).toHaveText('Saved')
  await notes.getByRole('textbox', { name: 'Notes' }).fill('Somewhere away from the city lights')
  await notes.getByRole('button', { name: 'Done' }).click()
  await expect(notes).toBeHidden()

  // Still there after a reload, and for the owner.
  for (const viewer of [guest, page]) {
    await viewer.goto(shareUrl)
    await viewer.locator('[data-deck-card-id]').filter({ hasText: 'Stargazing' }).hover()
    await viewer.getByRole('button', { name: 'Notes on Stargazing' }).click()
    const reopened = viewer.getByRole('dialog', { name: 'Stargazing' })
    await expect(reopened.getByRole('radio', { name: '4 stars' })).toBeChecked()
    await expect(reopened.getByRole('textbox', { name: 'Notes' })).toHaveValue('Somewhere away from the city lights')
    await viewer.keyboard.press('Escape')
    await expect(reopened).toBeHidden()
  }

  // docs/card-notes.md § "Clicking a side of the card" - the left half adds it to the plan.
  await card.click({ position: { x: box.width * 0.25, y: box.height * 0.7 } })
  await expect(guest.getByRole('button', { name: 'Discard: Stargazing' })).toBeVisible()

  await guestContext.close()
  expect(consoleErrors).toEqual([])
})

/** @see docs/card-notes.md § "Rating and notes on the card" - only the fact that there are notes shows */
test("the words of a note stay off the plan and the deck's edit page", async ({ page, browser, request }) => {
  await signUp(page, request, 'Alex')
  const shareUrl = await createDeck(page, 'Ideas for Sam')
  const note = 'Bring the good blanket'

  const guestContext = await newVisitor(browser)
  const guest = await guestContext.newPage()
  await guest.goto(shareUrl)
  const card = guest.locator('[data-deck-card-id]').filter({ hasText: 'Stargazing' })
  await card.hover()
  await guest.getByRole('button', { name: 'Notes on Stargazing' }).click()
  const notes = guest.getByRole('dialog', { name: 'Stargazing' })
  await notes.getByRole('textbox', { name: 'Notes' }).fill(note)
  await notes.getByRole('button', { name: 'Done' }).click()
  await expect(notes).toBeHidden()
  await card.hover()
  await guest.getByRole('button', { name: 'Add to plan: Stargazing' }).click()
  await guest.getByRole('button', { name: 'Done' }).click()
  await closeShareDialog(guest)
  await expect(guest).toHaveURL(/\/p\/[a-z0-9]+$/)
  const plan = guest.getByRole('region', { name: 'The plan' })
  await expect(plan.getByText('Stargazing')).toBeVisible()
  await expect(plan.getByText('Has notes.')).toBeAttached()
  await expect(guest.getByText(note)).toHaveCount(0)

  // The note was saved; it just isn't shown in those places.
  await guest.goto(shareUrl)
  await guest.locator('[data-deck-card-id]').filter({ hasText: 'Stargazing' }).hover()
  await guest.getByRole('button', { name: 'Notes on Stargazing' }).click()
  await expect(guest.getByRole('textbox', { name: 'Notes' })).toHaveValue(note)
  await guestContext.close()

  await page.reload()
  await expect(page.getByRole('button', { name: 'Edit Stargazing' })).toBeVisible()
  await expect(page.getByText(note)).toHaveCount(0)
})

/** @see docs/card-notes.md § "When the options show" - with a keyboard */
test("a card's options work from the keyboard", async ({ page, browser, request }) => {
  await signUp(page, request, 'Alex')
  const shareUrl = await createDeck(page, 'Ideas for Sam')

  const guestContext = await newVisitor(browser)
  const guest = await guestContext.newPage()
  await guest.goto(shareUrl)
  // The last control before the cards.
  const lastSort = guest.getByRole('group', { name: 'Sort ideas' }).getByRole('button').last()
  const focused = guest.locator(':focus')
  const firstOptions = guest.locator('[data-deck-card-id]').first().getByRole('button').first().locator('..')
  await expect(firstOptions).toHaveCSS('opacity', '0')

  await lastSort.focus()
  await guest.keyboard.press('Tab')
  await expect(focused).toHaveAttribute('aria-label', /^Add to plan: /)
  const title = ((await focused.getAttribute('aria-label')) ?? '').replace('Add to plan: ', '')
  const card = guest.locator('[data-deck-card-id]').filter({ has: focused })
  await expect(focused.locator('..')).toHaveCSS('opacity', '1')
  await expect(focused).toHaveCSS('font-weight', '700')
  await expect(card.getByRole('button', { name: `Notes on ${title}` })).toHaveCSS('font-weight', '400')
  await guest.keyboard.press('Enter')
  await expect(guest.getByRole('button', { name: `Discard: ${title}` })).toBeVisible()

  await lastSort.focus()
  await guest.keyboard.press('Tab')
  await guest.keyboard.press('Tab')
  await expect(focused).toHaveAttribute('aria-label', /^Notes on /)
  const notesTitle = ((await focused.getAttribute('aria-label')) ?? '').replace('Notes on ', '')
  await expect(focused).toHaveCSS('font-weight', '700')
  await guest.keyboard.press('Enter')
  await expect(guest.getByRole('dialog', { name: notesTitle })).toBeVisible()
  await guestContext.close()
})

/** @see docs/card-notes.md § "Opening a card's notes" */
test.describe("a card's notes", () => {
  let shareUrl: string
  test.beforeEach(async ({ page, request }) => {
    await signUp(page, request, 'Alex')
    shareUrl = await createDeck(page, 'Ideas for Sam')
  })

  async function openNotes(page: Page) {
    await page.goto(shareUrl)
    await page.locator('[data-deck-card-id]').filter({ hasText: 'Stargazing' }).hover()
    await page.getByRole('button', { name: 'Notes on Stargazing' }).click()
    const notes = page.getByRole('dialog', { name: 'Stargazing' })
    await expect(notes).toBeVisible()
    return notes
  }

  // The back of the card, once it has finished growing.
  async function settledSize(notes: Locator) {
    const back = notes.locator('div:has(> h2)')
    let size = { width: 0, height: 0 }
    await expect(async () => {
      const first = await back.boundingBox()
      await notes.page().evaluate(() => new Promise(requestAnimationFrame))
      const second = await back.boundingBox()
      expect(first).toBeTruthy()
      expect(second).toEqual(first)
      size = { width: second?.width ?? 0, height: second?.height ?? 0 }
    }).toPass()
    return size
  }

  test('keeps a card shape no wider than 540px, and fits a phone', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1100 })
    let size = await settledSize(await openNotes(page))
    expect(size.width).toBeLessThanOrEqual(540)
    expect(size.width).toBeGreaterThan(500)
    expect(size.width / size.height).toBeCloseTo(3 / 4, 2)

    await page.setViewportSize({ width: 375, height: 667 })
    size = await settledSize(await openNotes(page))
    expect(size.width).toBeLessThanOrEqual(375)
    expect(size.height).toBeLessThanOrEqual(667)
    expect(size.width).toBeGreaterThan(375 * 0.8)
    expect(size.width / size.height).toBeCloseTo(3 / 4, 2)
  })

  test('a click beside the card closes it', async ({ page }) => {
    const notes = await openNotes(page)
    await page.mouse.click(5, 5)
    await expect(notes).toBeHidden()
  })

  test('opens and closes with reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const notes = await openNotes(page)
    await notes.getByRole('button', { name: 'Done' }).click()
    await expect(notes).toBeHidden()
  })
})
