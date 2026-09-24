import { expect, test } from './fixtures'
import { latestSignInLink, uniqueEmail } from './helpers'

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
