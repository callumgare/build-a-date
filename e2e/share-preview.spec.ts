import { expect, newVisitor, test } from './fixtures'
import { createDeck, signUp } from './helpers'
import { expectJpeg, previewAddress, savePlanAsGuest } from './share-preview-helpers'

/** @see docs/share-previews.md § "When it's drawn" - a plan's picture is drawn as it's saved */
test('a plan has its own picture as soon as it is saved', async ({ page, browser, request }) => {
  await signUp(page, request, 'Alex')
  const shareUrl = await createDeck(page, 'Ideas for Sam')

  const guestContext = await newVisitor(browser)
  const guest = await guestContext.newPage()
  await savePlanAsGuest(guest, shareUrl)
  const address = await previewAddress(guest)
  expect(address).toMatch(/\/p\/[a-z0-9]+\/preview\?v=[a-z0-9]+$/)
  await expectJpeg(request, address)
  await guestContext.close()
})

/** @see docs/share-previews.md § "When it's drawn" - the deck's edit page draws its picture */
test("a deck's picture is drawn on its edit page, and the shared deck links to it", async ({
  page,
  browser,
  request,
}) => {
  await signUp(page, request, 'Alex')
  const shareUrl = await createDeck(page, 'Ideas for Sam')

  // Until then, the default picture.
  const visitorContext = await newVisitor(browser)
  const visitor = await visitorContext.newPage()
  await visitor.goto(shareUrl)
  expect(await previewAddress(visitor)).toMatch(/\/og\/default\.jpg$/)

  // The edit page (still open in the owner's tab) draws and sends it.
  await expect(async () => {
    await visitor.reload()
    expect(await previewAddress(visitor)).toMatch(/\/d\/[a-z0-9]+\/preview\?v=[a-z0-9]+$/)
  }).toPass({ timeout: 30_000 })
  const first = await previewAddress(visitor)
  await expectJpeg(request, first)

  // Changing a card the picture shows draws it again.
  await page.getByRole('button', { name: 'Edit Picnic in the Park' }).click()
  const editor = page.getByRole('dialog', { name: 'Edit idea' })
  await editor.getByLabel('Title').fill('Picnic by the River')
  await editor.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('button', { name: 'Edit Picnic by the River' })).toBeVisible()
  await expect(async () => {
    await visitor.reload()
    expect(await previewAddress(visitor)).not.toBe(first)
  }).toPass({ timeout: 30_000 })
  await expectJpeg(request, await previewAddress(visitor))
  await visitorContext.close()
})

/** @see docs/share-previews.md § "The static pictures" */
test('the sample deck has its picture from public/og', async ({ page, request }) => {
  await page.goto('/sample')
  const address = await previewAddress(page)
  expect(address).toMatch(/\/og\/sample\.jpg$/)
  await expectJpeg(request, address)
})

/** @see docs/share-previews.md § "The page's metadata" */
test('a shared page names its own address and the site for link previews', async ({ page }) => {
  await page.goto('/sample')
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', 'http://localhost:3100/sample')
  // The stand-in app id from .dev.vars.e2e, so the tag is there to find.
  await expect(page.locator('meta[property="fb:app_id"]')).toHaveAttribute('content', '1234567890123456')
})
