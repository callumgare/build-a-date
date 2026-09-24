import { expect, newVisitor, test } from './fixtures'
import { createDeck, latestSignInLink, signUp, uniqueEmail } from './helpers'

// Forms that must work before the page's JavaScript has loaded (a slow
// connection, a first compile in dev, a click that beats hydration) or
// without it at all. With JavaScript off, a form that relies on a click
// handler just reloads the page, so these fail loudly where a normal run
// would pass because hydration happened to win the race.
test.use({ javaScriptEnabled: false })

test('sign up, sign out and sign back in by email without JavaScript', async ({ page, request }) => {
  const email = uniqueEmail('nojs')

  await page.goto('/sign-up')
  await page.getByLabel('Your name').fill('Robin')
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Email me a link' }).click()
  await expect(page.getByRole('status')).toContainText(email)
  // Never a GET that puts the address in the URL.
  expect(page.url()).not.toContain('email=')

  await page.goto(await latestSignInLink(request, email))
  await expect(page).toHaveURL(/\/welcome$/)

  await page.goto('/settings')
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/$/)
  await page.goto('/settings')
  await expect(page).toHaveURL(/\/sign-in$/)

  await page.goto('/sign-in')
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Email me a sign-in link' }).click()
  await expect(page.getByRole('status')).toContainText(email)
})

test('ask to edit a deck, and later leave it, without JavaScript', async ({ page, browser, request }) => {
  // Making a deck and answering requests need JavaScript, so the owner has it.
  const ownerContext = await newVisitor(browser, { javaScriptEnabled: true })
  const owner = await ownerContext.newPage()
  const ownerEmail = await signUp(owner, request, 'Alex')
  const shareUrl = await createDeck(owner, 'Weekend plans', { empty: true })

  await signUp(page, request, 'Robin')
  await page.goto(`${shareUrl}/request`)
  await page.getByRole('button', { name: 'Send request' }).click()
  await expect(page).toHaveURL(/\/d\/[a-z0-9]+\/request$/)
  await expect(page.getByRole('status')).toContainText("You've asked to edit this deck")

  await owner.goto(await latestSignInLink(request, ownerEmail))
  await owner.getByRole('button', { name: 'Accept Robin' }).click()
  await expect(owner.getByRole('region', { name: 'Editors' })).toContainText('Robin')
  await ownerContext.close()

  // Without JavaScript there's no confirm step; the form just submits.
  await page.goto('/decks')
  await page.getByRole('link', { name: /Weekend plans/ }).click()
  await page.getByRole('button', { name: 'Leave deck' }).click()
  await expect(page).toHaveURL(/\/decks$/)
  await expect(page.getByRole('heading', { name: 'Your decks' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Shared decks' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /Weekend plans/ })).toHaveCount(0)
})
