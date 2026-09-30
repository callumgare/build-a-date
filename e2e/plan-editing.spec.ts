import type { Page } from '@playwright/test'
import { expect, newVisitor, test } from './fixtures'
import { closeShareDialog, createDeck, pressOption, signUp } from './helpers'

async function pick(page: Page, title: string) {
  await pressOption(page.getByRole('button', { name: `Add to plan: ${title}` }))
  await expect(page.getByRole('button', { name: `Discard: ${title}` })).toBeAttached()
}

// Waits for the edit page, so a hover straight after lands on its cards
// rather than the plan page's, which are still showing while it loads.
async function editPlan(page: Page) {
  await page.getByRole('link', { name: 'Edit plan' }).click()
  await expect(page.getByText('Editing a plan')).toBeVisible()
}

// The room between the deck's name and the words under it, and between
// those and the buttons.
function headerGaps(page: Page) {
  return page.evaluate(() => {
    const box = (selector: string) => (document.querySelector(selector) as Element).getBoundingClientRect()
    const [title, lede, actions] = [box('[data-hero] h1'), box('[data-hero] p'), box('[data-plan-actions]')]
    return { underTitle: Math.round(lede.top - title.bottom), aboveButtons: Math.round(actions.top - lede.bottom) }
  })
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
  await guest.getByRole('button', { name: 'Save plan' }).click()
  await closeShareDialog(guest)
  await expect(guest).toHaveURL(/\/p\/[a-z0-9]+$/)
  const planUrl = guest.url()
  await guestContext.close()

  // Someone else, sent the plan's link, changes it.
  const partnerContext = await newVisitor(browser)
  const partner = await partnerContext.newPage()
  await partner.goto(planUrl)
  const onPlan = await headerGaps(partner)
  await partner.getByRole('link', { name: 'Edit plan' }).click()
  await expect(partner).toHaveURL(`${planUrl}/edit`)
  await expect(partner.getByText('Editing a plan')).toBeVisible()
  // docs/plans.md § "The plan page" - spaced just as the edit page is.
  expect(await headerGaps(partner)).toEqual(onPlan)
  const [first, second] = await planOrder(partner)
  expect(first).toContain('Stargazing')
  expect(second).toContain('Picnic in the Park')

  await pressOption(partner.getByRole('button', { name: 'Discard: Stargazing' }))
  await pick(partner, 'Board Game Night')
  await partner.getByRole('button', { name: 'Update Plan' }).click()

  // Its link hasn't changed, so the share dialog doesn't open.
  await expect(partner).toHaveURL(planUrl)
  await expect(partner.getByRole('dialog', { name: 'Share this date plan' })).toBeHidden()
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
  await guest.getByRole('button', { name: 'Save plan' }).click()
  await closeShareDialog(guest)
  await expect(guest).toHaveURL(/\/p\/[a-z0-9]+$/)
  const planUrl = guest.url()

  await editPlan(guest)
  await pressOption(guest.getByRole('button', { name: 'Discard: Picnic in the Park' }))
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
  await guest.getByRole('button', { name: 'Save plan' }).click()
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
  await guest.getByRole('button', { name: 'Save plan' }).click()
  await closeShareDialog(guest)
  await guestContext.close()

  await page.goto(shareUrl)
  const plans = page.getByRole('region', { name: 'Plans' })
  await expect(plans.getByRole('heading', { name: 'Plans (1)' })).toBeVisible()
  await expect(plans.getByText('1 idea')).toBeVisible()

  await pick(page, 'Picnic in the Park')
  await page.getByRole('button', { name: 'Save plan' }).click()
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
  await guest.getByRole('button', { name: 'Save plan' }).click()
  await closeShareDialog(guest)
  await expect(guest).toHaveURL(/\/p\/[a-z0-9]+$/)
  const planUrl = guest.url()

  async function discardStargazing() {
    await pressOption(guest.getByRole('button', { name: 'Discard: Stargazing' }))
    await expect(guest.locator('[data-card-id]')).toHaveCount(1)
  }

  // A reload keeps the change.
  await editPlan(guest)
  await discardStargazing()
  await guest.reload()
  await expect(guest.locator('[data-card-id]')).toHaveCount(1)
  await expect(guest.getByRole('button', { name: 'Discard: Picnic in the Park' })).toBeAttached()

  // Going back to the plan with the browser's back button drops it.
  await guest.goBack()
  await expect(guest).toHaveURL(planUrl)
  await editPlan(guest)
  await expect(guest.locator('[data-card-id]')).toHaveCount(2)

  // So does opening the plan's link again.
  await discardStargazing()
  await guest.goto(planUrl)
  await editPlan(guest)
  await expect(guest.locator('[data-card-id]')).toHaveCount(2)

  await guestContext.close()
})

/** @see docs/plans.md § "Picks are kept in the browser" - forgotten once Save plan has saved them */
test('Create new plan starts with nothing picked once a plan has been saved', async ({ page, browser, request }) => {
  await signUp(page, request, 'Alex')
  const shareUrl = await createDeck(page, 'Ideas for Sam')

  const guestContext = await newVisitor(browser)
  const guest = await guestContext.newPage()
  await guest.goto(shareUrl)
  await pick(guest, 'Stargazing')
  await guest.getByRole('button', { name: 'Save plan' }).click()
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
  await guest.getByRole('button', { name: 'Save plan' }).click()
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
  await pressOption(page.getByRole('button', { name: 'Edit Stargazing' }))
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

/** @see docs/plans.md § "Sharing a plan" - the dialog then takes ?share off the address */
test('the share dialog takes ?share off the address even on a slow device', async ({ page, browser, request }) => {
  await signUp(page, request, 'Alex')
  const shareUrl = await createDeck(page, 'Ideas for Sam')

  const guestContext = await newVisitor(browser)
  const guest = await guestContext.newPage()
  await guest.goto(shareUrl)
  await pick(guest, 'Stargazing')
  // A slow phone: the plan page can show before Next has finished going to
  // it, and Next then set the address back to the one with ?share.
  const devTools = await guestContext.newCDPSession(guest)
  await devTools.send('Emulation.setCPUThrottlingRate', { rate: 20 })
  await guest.getByRole('button', { name: 'Save plan' }).click()
  await expect(guest.getByRole('dialog', { name: 'Share this date plan' })).toBeVisible({ timeout: 30_000 })
  await expect(guest).toHaveURL(/\/p\/[a-z0-9]+$/, { timeout: 30_000 })
  await guestContext.close()
})

/** @see docs/card-layout.md § "The plan page's grids" - they shuffle to a new number of columns as the window is resized */
test("the plan page's cards shuffle into place when the window loses a column", async ({ page, browser, request }) => {
  await signUp(page, request, 'Alex')
  const shareUrl = await createDeck(page, 'Ideas for Sam')

  const guestContext = await newVisitor(browser)
  const guest = await guestContext.newPage()
  await guest.setViewportSize({ width: 1280, height: 900 })
  await guest.goto(shareUrl)
  for (const title of ['Stargazing', 'Picnic in the Park', 'Karaoke', 'Pottery Class']) await pick(guest, title)
  await guest.getByRole('button', { name: 'Save plan' }).click()
  await closeShareDialog(guest)
  await guest.mouse.move(2, 2)

  // The last card, where it's drawn within its grid, on every frame from
  // before the window narrows until it has stopped moving.
  const last = '[data-card-grid] > [data-card-id]:last-child'
  await guest.evaluate((last) => {
    const seen: { x: number; y: number }[] = []
    ;(window as unknown as { seen: typeof seen }).seen = seen
    requestAnimationFrame(function watch() {
      const card = document.querySelector(last)
      const box = card?.getBoundingClientRect()
      const grid = card?.parentElement?.getBoundingClientRect()
      if (box && grid) seen.push({ x: Math.round(box.x - grid.x), y: Math.round(box.y - grid.y) })
      requestAnimationFrame(watch)
    })
  }, last)
  const seen = () => guest.evaluate(() => (window as unknown as { seen: { x: number; y: number }[] }).seen)
  await expect.poll(async () => (await seen()).length).toBeGreaterThan(3)
  const before = (await seen()).length
  await guest.setViewportSize({ width: 700, height: 900 })
  await expect
    .poll(async () => {
      const places = await seen()
      const moving = await guest.locator(last).evaluate((card) => card.getAnimations().length)
      return (
        places.length > before + 5 && moving === 0 && new Set(places.slice(-5).map((p) => `${p.x},${p.y}`)).size === 1
      )
    })
    .toBe(true)

  const places = await seen()
  const distinct = new Set(places.map((place) => `${place.x},${place.y}`))
  // From the end of the first line down onto the next, through somewhere in
  // between rather than jumping.
  expect(places.at(-1)?.y).toBeGreaterThan(places[0].y)
  expect(distinct.size, [...distinct].join(' ')).toBeGreaterThan(2)
  await guestContext.close()
})
