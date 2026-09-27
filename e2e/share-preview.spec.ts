import type { APIRequestContext, Page } from '@playwright/test'
import { expect, newVisitor, test } from './fixtures'
import { closeShareDialog, createDeck, signUp } from './helpers'

// Finds the page's preview picture from its metadata, as a messaging app
// would, and checks it's a 1200×630 PNG.
async function expectPreview(page: Page, request: APIRequestContext) {
  const address = await page.locator('meta[property="og:image"]').getAttribute('content')
  expect(address).toMatch(/^http:\/\/localhost:3100\//)
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image')
  const response = await request.get(address ?? '')
  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toBe('image/png')
  const png = await response.body()
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630])
}

/** @see docs/share-previews.md § "The page's metadata" */
test('a shared deck, a plan and the sample deck each have a preview picture', async ({ page, browser, request }) => {
  await signUp(page, request, 'Alex')
  const shareUrl = await createDeck(page, 'Ideas for Sam')

  const guestContext = await newVisitor(browser)
  const guest = await guestContext.newPage()
  await guest.goto(shareUrl)
  await expectPreview(guest, request)

  await guest.locator('[data-deck-card-id]').filter({ hasText: 'Stargazing' }).hover()
  await guest.getByRole('button', { name: 'Add to plan: Stargazing' }).click()
  await guest.getByRole('button', { name: 'Save plan' }).click()
  await closeShareDialog(guest)
  await expectPreview(guest, request)

  await guest.goto('/sample')
  await expectPreview(guest, request)
  await guestContext.close()
})
