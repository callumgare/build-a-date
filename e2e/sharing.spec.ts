import { expect, newVisitor, test } from './fixtures'
import { latestSignInLink, uniqueEmail } from './helpers'

/** @see docs/deck-sharing.md § "Asking for edit access" */
test('someone with the link asks to edit, and the owner lets them in', async ({ page, browser, request }) => {
  // The owner, with a deck to share.
  const ownerEmail = uniqueEmail('sharer')
  await page.goto('/sign-up')
  await page.getByLabel('Your name').fill('Alex')
  await page.getByLabel('Email').fill(ownerEmail)
  await page.getByRole('button', { name: 'Email me a link' }).click()
  await page.goto(await latestSignInLink(request, ownerEmail))
  await page.getByRole('link', { name: 'Skip for now' }).click()
  await page.getByRole('button', { name: 'Make your first deck' }).click()
  await page.getByLabel('Name').fill('Weekend plans')
  await page.getByLabel('An empty deck').check()
  await page.getByRole('button', { name: 'Create deck' }).click()
  await expect(page.getByRole('heading', { name: 'Weekend plans' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Editors (0)' })).toBeVisible()
  const shareUrl = await page.getByLabel('Share link').inputValue()

  // Someone without an account asks, making one on the way.
  const helperEmail = uniqueEmail('helper')
  const helperContext = await newVisitor(browser)
  const helper = await helperContext.newPage()
  await helper.goto(shareUrl)
  await helper.getByRole('link', { name: 'Request edit access' }).click()
  await expect(helper).toHaveURL(/\/sign-in\?next=/)
  await helper.getByRole('link', { name: 'Make an account' }).click()
  await helper.getByLabel('Your name').fill('Sam')
  await helper.getByLabel('Email').fill(helperEmail)
  await helper.getByRole('button', { name: 'Email me a link' }).click()
  await helper.goto(await latestSignInLink(request, helperEmail))
  await helper.getByRole('link', { name: 'Skip for now' }).click()
  await expect(helper).toHaveURL(/\/d\/[a-z0-9]+\/request$/)
  await helper.getByRole('button', { name: 'Send request' }).click()
  await expect(helper.getByRole('status')).toContainText("You've asked to edit this deck")
  await helper.goto(shareUrl)
  await expect(helper.getByText("You've asked to edit this deck")).toBeVisible()

  // The owner is emailed a link to the deck, and says yes there.
  const ownerLink = await latestSignInLink(request, ownerEmail)
  expect(ownerLink).toMatch(/\/decks\/[^/]+$/)
  await page.goto(ownerLink)
  const requests = page.getByRole('region', { name: 'Edit requests' })
  await expect(requests).toContainText(helperEmail)
  await requests.getByRole('button', { name: 'Accept Sam' }).click()
  await expect(requests).toBeHidden()
  await expect(page.getByRole('region', { name: 'Editors' })).toContainText(helperEmail)

  // It's under Shared decks for the helper, who can now add ideas.
  await helper.goto('/decks')
  await expect(helper.getByRole('heading', { name: 'Shared decks' })).toBeVisible()
  await helper.getByRole('link', { name: /Weekend plans/ }).click()
  await expect(helper.getByRole('button', { name: 'Delete deck' })).toBeHidden()
  await helper.getByRole('button', { name: 'Add an idea' }).click()
  const editor = helper.getByRole('dialog', { name: 'Edit idea' })
  await editor.getByLabel('Title').fill('Farmers market')
  await editor.getByRole('button', { name: 'Save' }).click()
  await expect(editor).toBeHidden()

  await page.reload()
  await expect(page.getByRole('button', { name: 'Edit Farmers market' })).toBeVisible()
  await helperContext.close()
})
