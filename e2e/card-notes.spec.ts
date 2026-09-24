import { expect, newVisitor, test } from './fixtures'
import { latestSignInLink, uniqueEmail } from './helpers'

/** @see docs/card-notes.md § "Who can change them" */
test('someone with the link rates an idea and leaves notes the owner can see', async ({ page, browser, request }) => {
  const consoleErrors: string[] = []
  const email = uniqueEmail('noter')
  await page.goto('/sign-up')
  await page.getByLabel('Your name').fill('Alex')
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Email me a link' }).click()
  await page.goto(await latestSignInLink(request, email))
  await page.getByRole('link', { name: 'Skip for now' }).click()
  await page.getByRole('button', { name: 'Make your first deck' }).click()
  await page.getByLabel('Name').fill('Ideas for Sam')
  await page.getByRole('button', { name: 'Create deck' }).click()
  await expect(page.getByRole('heading', { name: 'Ideas for Sam' })).toBeVisible()
  const shareUrl = await page.getByLabel('Share link').inputValue()

  // Someone without an account opens the link.
  const guestContext = await newVisitor(browser)
  const guest = await guestContext.newPage()
  guest.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  await guest.goto(shareUrl)
  const card = guest.locator('[data-deck-card-id]').filter({ hasText: 'Stargazing' })

  // docs/card-notes.md § "Card actions" - a click on the card itself doesn't add it.
  await card.click({ position: { x: 10, y: 10 } })
  await expect(guest.getByRole('button', { name: 'Discard: Stargazing' })).toHaveCount(0)

  await card.hover()
  await guest.getByRole('button', { name: 'Notes on Stargazing' }).click()
  const notes = guest.getByRole('dialog', { name: 'Stargazing' })
  await expect(notes).toBeVisible()
  await notes.getByRole('radio', { name: '4 stars' }).locator('..').click()
  await expect(notes.getByRole('status')).toHaveText('Saved')
  await notes.getByRole('textbox', { name: 'Notes' }).fill('Somewhere away from the city lights')
  await notes.getByRole('button', { name: 'Done' }).click()
  await expect(notes).toBeHidden()

  // Still there after a reload, and for the owner.
  for (const viewer of [guest, page]) {
    await viewer.goto(shareUrl)
    await viewer.locator('[data-deck-card-id]').filter({ hasText: 'Stargazing' }).hover()
    await viewer.getByRole('button', { name: 'Notes on Stargazing' }).click()
    const reopened = viewer.getByRole('dialog', { name: 'Stargazing' })
    await expect(reopened.getByRole('radio', { name: '4 stars' })).toBeChecked()
    await expect(reopened.getByRole('textbox', { name: 'Notes' })).toHaveValue('Somewhere away from the city lights')
    await viewer.keyboard.press('Escape')
    await expect(reopened).toBeHidden()
  }

  // Adding to the plan is still one press away.
  await card.hover()
  await guest.getByRole('button', { name: 'Add to plan: Stargazing' }).click()
  await expect(guest.getByRole('button', { name: 'Discard: Stargazing' })).toBeVisible()

  await guestContext.close()
  expect(consoleErrors).toEqual([])
})
