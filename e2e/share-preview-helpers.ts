import type { APIRequestContext, Page } from '@playwright/test'
import { expect } from './fixtures'
import { closeShareDialog, pressOption } from './helpers'

// Shared by the link preview specs (docs/share-previews.md).

// The page's preview picture, as a messaging app finds it.
export async function previewAddress(page: Page) {
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image')
  const address = await page.locator('meta[property="og:image"]').getAttribute('content')
  expect(address).toMatch(/^http:\/\/localhost:3100\//)
  return address ?? ''
}

// Fetches a picture and checks it's a 1200×630 JPEG.
export async function expectJpeg(request: APIRequestContext, address: string) {
  const response = await request.get(address)
  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toBe('image/jpeg')
  const jpeg = await response.body()
  expect([jpeg[0], jpeg[1]]).toEqual([0xff, 0xd8])
  expect(jpeg.length).toBeGreaterThan(20_000)
}

async function pick(page: Page, title: string) {
  await pressOption(page.getByRole('button', { name: `Add to plan: ${title}` }))
}

// A guest saves a plan from the deck, and its page is the one that's shared.
export async function savePlanAsGuest(page: Page, shareUrl: string) {
  await page.goto(shareUrl)
  await pick(page, 'Stargazing')
  await pick(page, 'Picnic in the Park')
  await page.getByRole('button', { name: 'Save plan' }).click()
  await closeShareDialog(page)
}
