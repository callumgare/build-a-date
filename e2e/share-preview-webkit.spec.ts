import { chromium } from '@playwright/test'
import { newVisitor, test } from './fixtures'
import { createDeck, signUp } from './helpers'
import { expectJpeg, previewAddress, savePlanAsGuest } from './share-preview-helpers'

// Safari has had trouble drawing an SVG with pictures in it onto a canvas, so
// drawing is checked there too (docs/share-previews.md § "Drawing in the
// browser").
test.use({ browserName: 'webkit' })

/** @see docs/share-previews.md § "When it's drawn" - a plan's picture is drawn as it's saved */
test('in WebKit, a plan has its own picture as soon as it is saved', async ({ browser, request, baseURL }) => {
  // Signing up relies on Chrome's virtual passkeys, so the deck is made there.
  const owner = await chromium.launch()
  const ownerContext = await newVisitor(owner, { baseURL })
  const shareUrl = await createDeck(await signedUp(ownerContext, request), 'Ideas for Sam')
  await owner.close()

  const guestContext = await newVisitor(browser)
  const guest = await guestContext.newPage()
  await savePlanAsGuest(guest, shareUrl)
  await expectJpeg(request, await previewAddress(guest))
  await guestContext.close()
})

async function signedUp(context: Awaited<ReturnType<typeof newVisitor>>, request: Parameters<typeof signUp>[1]) {
  const page = await context.newPage()
  await signUp(page, request, 'Alex')
  return page
}
