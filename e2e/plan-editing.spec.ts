import type { Page } from '@playwright/test'
import { expect, newVisitor, test } from './fixtures'
import { closeShareDialog, createDeck, signUp } from './helpers'

async function pick(page: Page, title: string) {
  await page.locator('[data-deck-card-id]').filter({ hasText: title }).hover()
  await page.getByRole('button', { name: `Add to plan: ${title}` }).click()
  await expect(page.getByRole('button', { name: `Discard: ${title}` })).toBeAttached()
}

function planOrder(page: Page) {
  return page.locator('[data-card-id]').evaluateAll((cards) => cards.map((card) => card.textContent ?? ''))
}

/** @see docs/plans.md § "Editing a plan" */
test('someone with the link edits a saved plan, and it keeps its link', async ({ page, browser, request }) => {
  await signUp(page, request, 'Alex')
  const shareUrl = await createDeck(page, 'Ideas for Sam')

  const guestContext = await newVisitor(browser)
  const guest = await guestContext.newPage()
  await guest.goto(shareUrl)
  await pick(guest, 'Stargazing')
  await pick(guest, 'Picnic in the Park')
  await guest.getByRole('button', { name: 'Done' }).click()
  await closeShareDialog(guest)
  await expect(guest).toHaveURL(/\/p\/[a-z0-9]+$/)
  const planUrl = guest.url()
  await guestContext.close()

  // Someone else, sent the plan's link, changes it.
  const partnerContext = await newVisitor(browser)
  const partner = await partnerContext.newPage()
  await partner.goto(planUrl)
  await partner.getByRole('link', { name: 'Edit plan' }).click()
  await expect(partner).toHaveURL(`${planUrl}/edit`)
  await expect(partner.getByText('Editing a plan')).toBeVisible()
  const [first, second] = await planOrder(partner)
  expect(first).toContain('Stargazing')
  expect(second).toContain('Picnic in the Park')

  const stargazing = partner.locator('[data-card-id]').filter({ hasText: 'Stargazing' })
  await stargazing.hover()
  await partner.getByRole('button', { name: 'Discard: Stargazing' }).click()
  await pick(partner, 'Board Game Night')
  await partner.getByRole('button', { name: 'Update Plan' }).click()
  await closeShareDialog(partner)

  await expect(partner).toHaveURL(planUrl)
  const plan = partner.getByRole('region', { name: 'The plan' })
  await expect(plan.getByText('Picnic in the Park')).toBeVisible()
  await expect(plan.getByText('Board Game Night')).toBeVisible()
  await expect(plan.getByText('Stargazing')).toHaveCount(0)
  await partnerContext.close()
})

/** @see docs/plans.md § "Editing a plan" - Cancel */
test('Cancel goes back to the plan as it was, and forgets what was changed', async ({ page, browser, request }) => {
  await signUp(page, request, 'Alex')
  const shareUrl = await createDeck(page, 'Ideas for Sam')

  const guestContext = await newVisitor(browser)
  const guest = await guestContext.newPage()
  await guest.goto(shareUrl)
  await pick(guest, 'Picnic in the Park')
  await guest.getByRole('button', { name: 'Done' }).click()
  await closeShareDialog(guest)
  await expect(guest).toHaveURL(/\/p\/[a-z0-9]+$/)
  const planUrl = guest.url()

  await guest.getByRole('link', { name: 'Edit plan' }).click()
  await guest.locator('[data-card-id]').filter({ hasText: 'Picnic in the Park' }).hover()
  await guest.getByRole('button', { name: 'Discard: Picnic in the Park' }).click()
  await guest.getByRole('link', { name: 'Cancel' }).click()
  await expect(guest).toHaveURL(planUrl)
  await expect(guest.getByRole('region', { name: 'The plan' }).getByText('Picnic in the Park')).toBeVisible()
  await guest.getByRole('link', { name: 'Edit plan' }).click()
  await expect(guest.getByRole('button', { name: 'Discard: Picnic in the Park' })).toBeAttached()

  await guestContext.close()
})

/** @see docs/plans.md § "Deleting a plan" */
test('someone with the link deletes a plan from its edit page', async ({ page, browser, request }) => {
  await signUp(page, request, 'Alex')
  const shareUrl = await createDeck(page, 'Ideas for Sam')

  const guestContext = await newVisitor(browser)
  const guest = await guestContext.newPage()
  await guest.goto(shareUrl)
  await pick(guest, 'Stargazing')
  await guest.getByRole('button', { name: 'Done' }).click()
  await closeShareDialog(guest)
  const planUrl = guest.url()

  await guest.getByRole('link', { name: 'Edit plan' }).click()
  await expect(guest.getByRole('button', { name: 'Clear plan' })).toHaveCount(0)
  guest.once('dialog', (dialog) => dialog.accept())
  await guest.getByRole('button', { name: 'Delete plan' }).click()
  await expect(guest).toHaveURL(shareUrl)
  await expect(guest.locator('[data-card-id]')).toHaveCount(0)

  const response = await guest.goto(planUrl)
  expect(response?.status()).toBe(404)
  await guestContext.close()
})

/** @see docs/deck-sharing.md § "Who can do what" - owners and editors see the deck's plans */
test("the owner sees the deck's plans on the shared deck, and a new one straight away", async ({
  page,
  browser,
  request,
}) => {
  await signUp(page, request, 'Alex')
  const shareUrl = await createDeck(page, 'Ideas for Sam')

  const guestContext = await newVisitor(browser)
  const guest = await guestContext.newPage()
  await guest.goto(shareUrl)
  await expect(guest.getByRole('region', { name: 'Plans' })).toHaveCount(0)
  await pick(guest, 'Stargazing')
  await guest.getByRole('button', { name: 'Done' }).click()
  await closeShareDialog(guest)
  await guestContext.close()

  await page.goto(shareUrl)
  const plans = page.getByRole('region', { name: 'Plans' })
  await expect(plans.getByRole('heading', { name: 'Plans (1)' })).toBeVisible()
  await expect(plans.getByText('1 idea')).toBeVisible()

  await pick(page, 'Picnic in the Park')
  await page.getByRole('button', { name: 'Done' }).click()
  await closeShareDialog(page)
  await page.goBack()
  await expect(plans.getByRole('heading', { name: 'Plans (2)' })).toBeVisible()
})

/** @see docs/plans.md § "Editing a plan" - unsaved changes last a reload, not a trip back to the plan */
test('unsaved changes to a plan survive a reload, but not going back to the plan', async ({
  page,
  browser,
  request,
}) => {
  await signUp(page, request, 'Alex')
  const shareUrl = await createDeck(page, 'Ideas for Sam')

  const guestContext = await newVisitor(browser)
  const guest = await guestContext.newPage()
  await guest.goto(shareUrl)
  await pick(guest, 'Stargazing')
  await pick(guest, 'Picnic in the Park')
  await guest.getByRole('button', { name: 'Done' }).click()
  await closeShareDialog(guest)
  await expect(guest).toHaveURL(/\/p\/[a-z0-9]+$/)
  const planUrl = guest.url()

  async function discardStargazing() {
    await guest.locator('[data-card-id]').filter({ hasText: 'Stargazing' }).hover()
    await guest.getByRole('button', { name: 'Discard: Stargazing' }).click()
    await expect(guest.locator('[data-card-id]')).toHaveCount(1)
  }

  // A reload keeps the change.
  await guest.getByRole('link', { name: 'Edit plan' }).click()
  await discardStargazing()
  await guest.reload()
  await expect(guest.locator('[data-card-id]')).toHaveCount(1)
  await expect(guest.getByRole('button', { name: 'Discard: Picnic in the Park' })).toBeAttached()

  // Going back to the plan with the browser's back button drops it.
  await guest.goBack()
  await expect(guest).toHaveURL(planUrl)
  await guest.getByRole('link', { name: 'Edit plan' }).click()
  await expect(guest.locator('[data-card-id]')).toHaveCount(2)

  // So does opening the plan's link again.
  await discardStargazing()
  await guest.goto(planUrl)
  await guest.getByRole('link', { name: 'Edit plan' }).click()
  await expect(guest.locator('[data-card-id]')).toHaveCount(2)

  await guestContext.close()
})

/** @see docs/plans.md § "Picks are kept in the browser" - forgotten once Done has saved them */
test('Create new plan starts with nothing picked once a plan has been saved', async ({ page, browser, request }) => {
  await signUp(page, request, 'Alex')
  const shareUrl = await createDeck(page, 'Ideas for Sam')

  const guestContext = await newVisitor(browser)
  const guest = await guestContext.newPage()
  await guest.goto(shareUrl)
  await pick(guest, 'Stargazing')
  await guest.getByRole('button', { name: 'Done' }).click()
  await closeShareDialog(guest)
  await expect(guest).toHaveURL(/\/p\/[a-z0-9]+$/)

  await guest.getByRole('link', { name: 'Create new plan' }).click()
  await expect(guest.locator('[data-deck-card-id]').filter({ hasText: 'Stargazing' })).toBeAttached()
  await expect(guest.locator('[data-card-id]')).toHaveCount(0)

  await guestContext.close()
})

/** @see docs/card-notes.md § "Card actions" - on a plan, only Notes */
test('someone rates an idea from the plan page, and it shows in the corner', async ({ page, browser, request }) => {
  await signUp(page, request, 'Alex')
  const shareUrl = await createDeck(page, 'Ideas for Sam')

  const guestContext = await newVisitor(browser)
  const guest = await guestContext.newPage()
  await guest.goto(shareUrl)
  await pick(guest, 'Stargazing')
  await guest.getByRole('button', { name: 'Done' }).click()
  await closeShareDialog(guest)

  const card = guest.locator('[data-card-id]').filter({ hasText: 'Stargazing' })
  await card.hover()
  await expect(guest.getByRole('button', { name: 'Notes on Stargazing' })).toBeVisible()
  await expect(guest.getByRole('button', { name: /^Discard/ })).toHaveCount(0)
  // Anywhere on the card, left half included, opens the notes.
  const box = await card.boundingBox()
  if (!box) throw new Error('Card has no size')
  await card.click({ position: { x: box.width * 0.25, y: box.height * 0.6 } })
  const notes = guest.getByRole('dialog', { name: 'Stargazing' })
  await notes.getByRole('radio', { name: '4 stars' }).locator('..').click()
  await expect(notes.getByRole('status')).toHaveText('Saved')
  await notes.getByRole('button', { name: 'Done' }).click()
  await expect(notes).toBeHidden()
  await expect(card.getByText('Rated 4 out of 5.')).toBeAttached()

  // The owner can edit the idea from the plan; the guest can't.
  await expect(guest.getByRole('button', { name: 'Edit Stargazing' })).toHaveCount(0)
  await page.goto(guest.url())
  await page.locator('[data-card-id]').filter({ hasText: 'Stargazing' }).hover()
  await page.getByRole('button', { name: 'Edit Stargazing' }).click()
  await expect(page.getByRole('dialog', { name: 'Edit idea' })).toBeVisible()

  await guestContext.close()
})

/** @see docs/plans.md § "Picks are kept in the browser" */
test('picks come back after a reload, straight in the plan', async ({ page, browser, request }) => {
  await signUp(page, request, 'Alex')
  const shareUrl = await createDeck(page, 'Ideas for Sam')

  const guestContext = await newVisitor(browser)
  const guest = await guestContext.newPage()
  await guest.goto(shareUrl)
  await pick(guest, 'Stargazing')
  await pick(guest, 'Picnic in the Park')
  expect(new URL(guest.url()).hash).toBe('')

  // Watches every frame from before the page's own scripts run, for a card
  // in the plan that's anywhere but its place: one flying up from the deck.
  await guest.addInitScript(() => {
    const record = window as unknown as { planCardMoved: boolean }
    record.planCardMoved = false
    const start = performance.now()
    function sample() {
      for (const card of document.querySelectorAll('[data-card-id]')) {
        const transform = getComputedStyle(card).transform
        if (transform !== 'none' && transform !== 'matrix(1, 0, 0, 1, 0, 0)') record.planCardMoved = true
      }
      if (performance.now() - start < 3000) requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  })
  await guest.mouse.move(0, 0)
  await guest.reload()

  await expect
    .poll(() => planOrder(guest))
    .toEqual([expect.stringContaining('Stargazing'), expect.stringContaining('Picnic in the Park')])
  await guest.waitForTimeout(1500)
  expect(await guest.evaluate(() => (window as unknown as { planCardMoved: boolean }).planCardMoved)).toBe(false)
  await expect(guest.locator('[data-deck-card-id]').filter({ hasText: 'Stargazing' })).toHaveCount(0)

  await guestContext.close()
})
