import { expect, newVisitor, test } from './fixtures'
import { addVirtualAuthenticator, latestSignInLink, uniqueEmail } from './helpers'

test('sign up, share a deck, and get a plan back', async ({ page, browser, request }) => {
  const email = uniqueEmail('owner')
  await addVirtualAuthenticator(page)
  // Hydration mismatches and other client errors only show up here.
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  // Sign up with an email link, then set up a passkey.
  await page.goto('/sign-up')
  await page.getByLabel('Your name').fill('Alex')
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Email me a link' }).click()
  await expect(page.getByRole('status')).toContainText(email)

  await page.goto(await latestSignInLink(request, email))
  await expect(page).toHaveURL(/\/welcome$/)
  await expect(page.getByRole('heading', { name: 'Welcome, Alex' })).toBeVisible()
  await page.getByRole('button', { name: 'Create a passkey' }).click()
  await expect(page).toHaveURL(/\/decks$/)

  // Sign out, and back in with the passkey alone.
  await page.getByRole('link', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('link', { name: 'Sign in' }).first()).toBeVisible()
  await page.goto('/sign-in')
  await page.getByRole('button', { name: 'Sign in with a passkey' }).click()
  await expect(page).toHaveURL(/\/decks$/)

  // A deck from the suggestions, plus one idea of our own.
  await page.getByRole('button', { name: 'Make your first deck' }).click()
  await page.getByLabel('Name').fill('Ideas for Sam')
  await page.getByRole('button', { name: 'Create deck' }).click()
  await expect(page.getByRole('heading', { name: 'Ideas for Sam' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Edit Picnic in the Park' })).toBeVisible()

  await page.getByRole('button', { name: 'Add an idea' }).click()
  const editor = page.getByRole('dialog', { name: 'Edit idea' })
  await editor.getByLabel('Title').fill('Rooftop Dinner')
  await editor.getByRole('textbox', { name: /^Tags/ }).fill('food & drink, night')
  await editor.getByRole('button', { name: 'Save' }).click()
  await expect(editor).toBeHidden()
  await expect(page.getByRole('button', { name: 'Edit Rooftop Dinner' })).toBeVisible()

  const shareUrl = await page.getByLabel('Share link').inputValue()

  // Someone without an account builds a plan from the link.
  const guestContext = await newVisitor(browser)
  const guest = await guestContext.newPage()
  await guest.goto(shareUrl)
  await expect(guest.getByRole('heading', { name: 'Ideas for Sam' })).toBeVisible()
  await guest.getByRole('button', { name: 'Add Rooftop Dinner to your plan' }).click()
  await guest.getByRole('button', { name: 'Add Stargazing to your plan' }).click()
  await guest.getByRole('button', { name: 'Done' }).click()
  await guest.getByRole('link', { name: 'Open your plan' }).click()

  await expect(guest).toHaveURL(/\/p\/[a-z0-9]+$/)
  const planUrl = guest.url()
  const plan = guest.getByRole('region', { name: 'The plan' })
  await expect(plan.getByText('Rooftop Dinner')).toBeVisible()
  await expect(plan.getByText('Stargazing')).toBeVisible()
  await guestContext.close()

  // The owner sees it on their deck.
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Plans (1)' })).toBeVisible()
  await page.locator('.plan-list a').first().click()
  await expect(page).toHaveURL(planUrl)

  expect(consoleErrors).toEqual([])
})

test('someone who lost their passkey gets back in by email', async ({ page, browser, request }) => {
  const email = uniqueEmail('forgetful')

  // An account with a passkey on one device...
  const firstDevice = await newVisitor(browser)
  const firstPage = await firstDevice.newPage()
  await addVirtualAuthenticator(firstPage)
  await firstPage.goto('/sign-up')
  await firstPage.getByLabel('Your name').fill('Jo')
  await firstPage.getByLabel('Email').fill(email)
  await firstPage.getByRole('button', { name: 'Email me a link' }).click()
  await firstPage.goto(await latestSignInLink(request, email))
  await firstPage.getByRole('button', { name: 'Create a passkey' }).click()
  await expect(firstPage).toHaveURL(/\/decks$/)
  await firstDevice.close()

  // ...then a new device with no passkey on it: email instead, then a new
  // passkey from Settings.
  await addVirtualAuthenticator(page)
  await page.goto('/sign-in')
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Email me a sign-in link' }).click()
  await expect(page.getByRole('status')).toContainText(email)

  await page.goto(await latestSignInLink(request, email))
  await expect(page).toHaveURL(/\/decks$/)
  await page.getByRole('link', { name: 'Settings' }).click()
  await expect(page.getByText('Lost a device?')).toBeVisible()
  await expect(page.getByRole('listitem')).toHaveCount(1)

  await page.getByRole('button', { name: 'Add a passkey' }).click()
  await expect(page.getByRole('listitem')).toHaveCount(2)
})

test('someone who skipped the passkey signs in by email', async ({ page, request }) => {
  const email = uniqueEmail('skipper')
  await page.goto('/sign-up')
  await page.getByLabel('Your name').fill('Kim')
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Email me a link' }).click()
  await page.goto(await latestSignInLink(request, email))
  await page.getByRole('link', { name: 'Skip for now' }).click()
  await expect(page).toHaveURL(/\/decks$/)

  await page.getByRole('link', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/$/)

  await page.goto('/sign-in')
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Email me a sign-in link' }).click()
  await page.goto(await latestSignInLink(request, email))
  // Signed in, and offered a passkey again.
  await expect(page).toHaveURL(/\/welcome$/)
  await expect(page.getByRole('button', { name: 'Create a passkey' })).toBeVisible()
})

test('a used sign-in link is turned away', async ({ page, request }) => {
  const email = uniqueEmail('twice')
  await page.goto('/sign-up')
  await page.getByLabel('Your name').fill('Sam')
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Email me a link' }).click()
  const link = await latestSignInLink(request, email)

  await page.goto(link)
  await expect(page).toHaveURL(/\/welcome$/)
  await page.context().clearCookies()
  await page.goto(link)
  await expect(page).toHaveURL(/\/sign-in\?error=/)
  await expect(page.getByText('That sign-in link has expired or was already used')).toBeVisible()
})
