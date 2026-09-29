import { expect, test } from './fixtures'
import { pressOption } from './helpers'

/** @see docs/sample-deck.md § "What's different" */
test('someone signed out tries the sample deck, then goes to make their own', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Try a sample deck' }).click()
  await expect(page).toHaveURL(/\/sample$/)
  await expect(page.getByRole('heading', { name: 'Sample Deck' })).toBeVisible()

  await pressOption(page.getByRole('button', { name: 'Add to plan: Stargazing' }))
  const plan = page.getByRole('region', { name: 'Your plan' })
  await expect(plan.locator('[data-card-id]').filter({ hasText: 'Stargazing' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save plan' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Request edit access' })).toHaveCount(0)

  await page.getByRole('link', { name: 'Create your own deck' }).click()
  await expect(page).toHaveURL(/\/sign-up$/)
})
