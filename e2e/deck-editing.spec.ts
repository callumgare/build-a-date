import { expect, newVisitor, test } from './fixtures'
import { closeShareDialog, createDeck, pressOption, signUp } from './helpers'

/** @see docs/card-layout.md § "The grid of cards" - each card is between
 * 200px and 250px wide, on a window too narrow for a 200px card as much as
 * on one wider than the page. The spot for adding an idea is never a card
 * tall: it takes its column's width but only its contents' height
 * (docs/quick-add.md § "Adding an idea"). */
test('the deck page keeps its cards their usual size, and the add-card spot no taller than its contents', async ({
  page,
  request,
}) => {
  // One column: the grid caps the card at 250px rather than stretching it to
  // the page's width, and the add-card spot has its line to itself.
  await page.setViewportSize({ width: 380, height: 900 })
  await signUp(page, request, 'Alex')
  await createDeck(page, 'Card sizes')
  await expect(page.getByRole('button', { name: /Edit / }).first()).toBeVisible()

  const measure = () =>
    page.evaluate(() => {
      const controls = document.querySelector('[data-add-card-controls]')
      if (!controls) throw new Error('No add-card controls on the deck page')
      const grid = controls.closest('[data-card-grid]')
      if (!grid) throw new Error('The add-card controls are not in a card grid')
      const cards = [...grid.children].filter((el) => !el.contains(controls))
      const children = [...controls.children].map((child) => child.getBoundingClientRect().height)
      const style = getComputedStyle(controls)
      const gaps = (parseFloat(style.rowGap) || 0) * (children.length - 1)
      const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
      return {
        cardWidth: Math.round(cards[0].getBoundingClientRect().width),
        cardHeight: Math.round(cards[0].getBoundingClientRect().height),
        controlsHeight: Math.round(controls.getBoundingClientRect().height),
        controlsContents: Math.round(children.reduce((a, b) => a + b, 0) + gaps + padding),
      }
    })

  const narrow = await measure()
  expect(narrow.cardWidth).toBeLessThanOrEqual(250)
  expect(narrow.controlsHeight).toBeLessThan(narrow.cardHeight)
  expect(Math.abs(narrow.controlsHeight - narrow.controlsContents)).toBeLessThan(8)

  // The grid works out its columns from its own section (the page, up to
  // 1240px), not from the whole 2000px window: measuring the window instead
  // shares a narrower page between many more columns, and the cards shrink.
  await page.setViewportSize({ width: 2000, height: 1000 })
  await expect.poll(async () => (await measure()).cardWidth, { timeout: 15_000 }).toBeLessThanOrEqual(250)
  const wide = await measure()
  expect(wide.cardWidth).toBeGreaterThanOrEqual(200)
  expect(wide.controlsHeight).toBeLessThan(wide.cardHeight)
})

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
  await pressOption(guest.getByRole('button', { name: 'Add to plan: Stargazing' }))
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
