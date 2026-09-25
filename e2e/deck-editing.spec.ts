import { expect, newVisitor, test } from './fixtures'
import { closeShareDialog, createDeck, signUp } from './helpers'

test('the owner renames a deck, changes its ideas and deletes it', async ({ page, browser, request }) => {
  await signUp(page, request, 'Alex')
  const shareUrl = await createDeck(page, 'Ideas for Sam')

  await page.getByRole('button', { name: 'Rename' }).click()
  await page.getByLabel('Deck name').fill('Ideas for Jo')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { name: 'Ideas for Jo' })).toBeVisible()

  await page.getByRole('button', { name: 'Edit Picnic in the Park' }).click()
  const editor = page.getByRole('dialog', { name: 'Edit idea' })
  await editor.getByLabel('Title').fill('Picnic by the River')
  await editor.getByRole('button', { name: 'Save' }).click()
  await expect(editor).toBeHidden()
  await expect(page.getByRole('button', { name: 'Edit Picnic by the River' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Edit Picnic in the Park' })).toHaveCount(0)

  // A plan made from a single idea...
  const guestContext = await newVisitor(browser)
  const guest = await guestContext.newPage()
  await guest.goto(shareUrl)
  await expect(guest.getByRole('heading', { name: 'Ideas for Jo' })).toBeVisible()
  await guest.locator('[data-deck-card-id]').filter({ hasText: 'Stargazing' }).hover()
  await guest.getByRole('button', { name: 'Add to plan: Stargazing' }).click()
  await guest.getByRole('button', { name: 'Save plan' }).click()
  await closeShareDialog(guest)
  await expect(guest).toHaveURL(/\/p\/[a-z0-9]+$/)
  await expect(guest.getByRole('region', { name: 'The plan' }).getByText('Stargazing')).toBeVisible()

  // ...which the owner then deletes.
  await page.getByRole('button', { name: 'Edit Stargazing' }).click()
  page.once('dialog', (dialog) => dialog.accept())
  await editor.getByRole('button', { name: 'Delete' }).click()
  await expect(editor).toBeHidden()
  await expect(page.getByRole('button', { name: 'Edit Stargazing' })).toHaveCount(0)

  await guest.reload()
  await expect(guest.getByText('The ideas in this plan have since been removed from the deck.')).toBeVisible()
  await guestContext.close()

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Delete deck' }).click()
  await expect(page).toHaveURL(/\/decks$/)
  await expect(page.getByRole('button', { name: 'Make your first deck' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Ideas for Jo/ })).toHaveCount(0)

  await page.goto(shareUrl)
  await expect(page.getByRole('heading', { name: 'Nothing here' })).toBeVisible()
})

/** @see docs/deck-sharing.md § "Answering requests" */
test('the owner turns down a request, then later removes an editor', async ({ page, browser, request }) => {
  await signUp(page, request, 'Alex')
  const shareUrl = await createDeck(page, 'Weekend plans', { empty: true })

  const helperContext = await newVisitor(browser)
  const helper = await helperContext.newPage()
  const helperEmail = await signUp(helper, request, 'Sam')
  await helper.goto(`${shareUrl}/request`)
  await helper.getByRole('button', { name: 'Send request' }).click()
  await expect(helper.getByRole('status')).toContainText("You've asked to edit this deck")

  await page.reload()
  const requests = page.getByRole('region', { name: 'Edit requests' })
  await requests.getByRole('button', { name: 'Decline Sam' }).click()
  await expect(requests).toBeHidden()
  await expect(page.getByRole('region', { name: 'Editors' })).not.toContainText(helperEmail)

  // Declining deletes the request, so they can ask again.
  await helper.reload()
  await helper.getByRole('button', { name: 'Send request' }).click()
  await expect(helper.getByRole('status')).toContainText("You've asked to edit this deck")

  await page.reload()
  await requests.getByRole('button', { name: 'Accept Sam' }).click()
  const editors = page.getByRole('region', { name: 'Editors' })
  await expect(editors).toContainText(helperEmail)

  // docs/deck-sharing.md § "Removing and leaving" - removing deletes the row, so they can ask again.
  page.once('dialog', (dialog) => dialog.accept())
  await editors.getByRole('button', { name: 'Remove Sam' }).click()
  await expect(page.getByRole('heading', { name: 'Editors (0)' })).toBeVisible()
  await expect(editors).not.toContainText(helperEmail)

  await helper.goto('/decks')
  await expect(helper.getByRole('heading', { name: 'Shared decks' })).toHaveCount(0)
  await helper.goto(`${shareUrl}/request`)
  await expect(helper.getByRole('button', { name: 'Send request' })).toBeVisible()
  await helperContext.close()
})

test('unknown share and plan links show the not-found page', async ({ page }) => {
  for (const path of ['/d/nope', '/p/nope']) {
    const response = await page.goto(path)
    expect(response?.status()).toBe(404)
    await expect(page.getByRole('heading', { name: 'Nothing here' })).toBeVisible()
  }
})
