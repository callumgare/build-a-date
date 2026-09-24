import { expect, newVisitor, test } from './fixtures'
import { addVirtualAuthenticator, createDeck, latestSignInLink, outboxCount, signUp, uniqueEmail } from './helpers'

/** @see docs/deck-sharing.md § "Asking for edit access" */
test('someone with the link asks to edit, and the owner lets them in', async ({ page, browser, request }) => {
  // The owner, with a deck to share.
  const ownerEmail = await signUp(page, request, 'Alex')
  const shareUrl = await createDeck(page, 'Weekend plans', { empty: true })
  const deckUrl = page.url()
  await expect(page.getByRole('heading', { name: 'Editors (0)' })).toBeVisible()

  // The owner's own share page links back to the deck's page.
  await page.goto(shareUrl)
  await expect(page.getByRole('link', { name: 'Request edit access' })).toHaveCount(0)
  await page.getByRole('link', { name: 'Edit this deck' }).click()
  await expect(page).toHaveURL(deckUrl)

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

  // docs/deck-sharing.md § "Why sending takes a press" - arriving on the page asks nothing.
  const emailsBefore = await outboxCount(request, ownerEmail)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Editors (0)' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Edit requests' })).toHaveCount(0)
  expect(await outboxCount(request, ownerEmail)).toBe(emailsBefore)

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
  await helper.goto(shareUrl)
  await helper.getByRole('link', { name: 'Edit this deck' }).click()
  await expect(helper).toHaveURL(deckUrl)
  await helper.getByRole('button', { name: 'Add an idea' }).click()
  const editor = helper.getByRole('dialog', { name: 'Edit idea' })
  await editor.getByLabel('Title').fill('Farmers market')
  await editor.getByRole('button', { name: 'Save' }).click()
  await expect(editor).toBeHidden()

  await page.reload()
  await expect(page.getByRole('button', { name: 'Edit Farmers market' })).toBeVisible()
  await helperContext.close()
})

/** @see docs/deck-sharing.md § "Returning after sign-in" */
test('each way of signing in comes back to the edit request', async ({ page, browser, request }) => {
  const ownerContext = await newVisitor(browser)
  const owner = await ownerContext.newPage()
  await signUp(owner, request, 'Alex')
  const shareUrl = await createDeck(owner, 'Weekend plans', { empty: true })
  await ownerContext.close()

  const email = uniqueEmail('returner')
  await addVirtualAuthenticator(page)
  // The virtual authenticator answers the email field's passkey autofill by
  // itself, where a person would have to pick it, and would sign in before
  // each step below gets to. So the sign-in page gets no autofill.
  await page.addInitScript(() => {
    if (window.PublicKeyCredential) PublicKeyCredential.isConditionalMediationAvailable = async () => false
  })
  async function askToEdit() {
    await page.goto(shareUrl)
    await page.getByRole('link', { name: 'Request edit access' }).click()
    await expect(page).toHaveURL(/\/sign-in\?next=/)
  }
  async function signOut() {
    await page.getByRole('link', { name: 'Settings' }).click()
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page).toHaveURL(/\/$/)
  }

  // An email link, then a new passkey on Welcome.
  await askToEdit()
  await page.getByRole('link', { name: 'Make an account' }).click()
  await page.getByLabel('Your name').fill('Sam')
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Email me a link' }).click()
  await page.goto(await latestSignInLink(request, email))
  await expect(page).toHaveURL(/\/welcome\?next=/)
  await page.getByRole('button', { name: 'Create a passkey' }).click()
  await expect(page).toHaveURL(/\/d\/[a-z0-9]+\/request$/)
  await expect(page.getByRole('button', { name: 'Send request' })).toBeVisible()

  // The passkey.
  await signOut()
  await askToEdit()
  await page.getByRole('button', { name: 'Sign in with a passkey' }).click()
  await expect(page).toHaveURL(/\/d\/[a-z0-9]+\/request$/)
  await expect(page.getByRole('button', { name: 'Send request' })).toBeVisible()

  // An email link, with a passkey already made.
  await signOut()
  await askToEdit()
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Email me a sign-in link' }).click()
  await page.goto(await latestSignInLink(request, email))
  await expect(page).toHaveURL(/\/d\/[a-z0-9]+\/request$/)
  await expect(page.getByRole('button', { name: 'Send request' })).toBeVisible()
})
