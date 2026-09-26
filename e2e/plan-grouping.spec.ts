import type { Locator, Page } from '@playwright/test'
import { expect, newVisitor, test } from './fixtures'
import { createDeck, signUp } from './helpers'

// Drags a card by its middle to the middle of a spot, or just left of it, a
// step at a time, as a mouse would. The spot is measured once the card is
// hovered, which can scroll the page.
async function dragCard(page: Page, card: Locator, spot: Locator, { before = false } = {}) {
  await card.hover()
  const box = await card.boundingBox()
  const spotBox = await spot.boundingBox()
  if (!box || !spotBox) throw new Error('Card has no size')
  const to = { x: before ? spotBox.x - 20 : spotBox.x + spotBox.width / 2, y: spotBox.y + spotBox.height / 2 }
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 25 })
  await page.mouse.up()
}

async function pick(page: Page, title: string) {
  await page.locator('[data-deck-card-id]').filter({ hasText: title }).hover()
  await page.getByRole('button', { name: `Add to plan: ${title}` }).click()
  await expect(page.getByRole('button', { name: `Discard: ${title}` })).toBeAttached()
}

/** @see docs/plans.md § "Groups" */
test('someone groups cards in their plan, gives the group a title and notes, and shares it', async ({
  page,
  browser,
  request,
}) => {
  await signUp(page, request, 'Alex')
  const shareUrl = await createDeck(page, 'Ideas for Sam')

  const guestContext = await newVisitor(browser)
  const guest = await guestContext.newPage()
  // Tall enough to show the plan's first row and a group together.
  await guest.setViewportSize({ width: 1280, height: 1600 })
  await guest.goto(shareUrl)
  for (const title of ['Stargazing', 'Picnic in the Park']) await pick(guest, title)

  await guest.getByRole('button', { name: 'Add group' }).click()
  const title = guest.getByRole('textbox', { name: 'Title of Group 1' })
  await expect(title).toBeFocused()
  await title.fill('After dark')
  const group = guest.getByRole('region', { name: 'After dark' })
  await group.getByRole('textbox', { name: 'Notes on After dark' }).fill('Bring a blanket')

  // Dragged down off the plan's first row into the group's empty row.
  await dragCard(
    guest,
    guest.locator('[data-card-id]').filter({ hasText: 'Stargazing' }),
    group.getByText('Drag ideas here'),
  )
  await expect(group.locator('[data-card-id]')).toHaveCount(1)
  await expect(group.locator('[data-card-id]')).toContainText('Stargazing')
  await expect(guest.getByRole('dialog')).toHaveCount(0)
  await expect(guest.getByRole('button', { name: 'Discard: Stargazing' })).toBeAttached()

  // Kept in the browser, so a reload keeps the group.
  await guest.reload()
  await expect(guest.getByRole('region', { name: 'After dark' }).locator('[data-card-id]')).toContainText('Stargazing')
  await expect(guest.getByRole('textbox', { name: 'Notes on After dark' })).toHaveValue('Bring a blanket')

  await guest.getByRole('button', { name: 'Save plan' }).click()
  await expect(guest).toHaveURL(/\/p\/[^/?]+/)
  await guest.getByRole('button', { name: 'Close' }).click()
  const savedGroup = guest.getByRole('region', { name: 'After dark' })
  await expect(savedGroup.getByRole('heading', { name: 'After dark' })).toBeVisible()
  await expect(savedGroup).toContainText('Bring a blanket')
  await expect(savedGroup.locator('[data-card-id]')).toContainText('Stargazing')

  // And back out of the group, from editing the plan.
  await guest.getByRole('link', { name: 'Edit plan' }).click()
  const editingGroup = guest.getByRole('region', { name: 'After dark' })
  await expect(editingGroup.locator('[data-card-id]')).toContainText('Stargazing')
  const firstRow = guest.locator('.plan-track').first()
  // Tried again until it takes, as the edit page may still be hydrating.
  await expect(async () => {
    await dragCard(guest, editingGroup.locator('[data-card-id]').first(), firstRow.locator('[data-card-id]').first(), {
      before: true,
    })
    await expect(firstRow.locator('[data-card-id]')).toHaveCount(2, { timeout: 1000 })
  }).toPass()
  await expect(firstRow.locator('[data-card-id]')).toHaveCount(2)
  await expect(firstRow.locator('[data-card-id]').first()).toContainText('Stargazing')
  await expect(editingGroup.getByText('Drag ideas here')).toBeVisible()

  await guestContext.close()
})

/** @see docs/card-layout.md § "Reordering the plan" - from the keyboard */
test('the arrow keys move a card between the plan and its groups', async ({ page, browser, request }) => {
  await signUp(page, request, 'Alex')
  const shareUrl = await createDeck(page, 'Ideas for Sam')

  const guestContext = await newVisitor(browser)
  const guest = await guestContext.newPage()
  await guest.goto(shareUrl)
  await pick(guest, 'Stargazing')
  await guest.getByRole('button', { name: 'Add group' }).click()
  const group = guest.getByRole('region', { name: 'Group 1' })

  await guest.getByRole('button', { name: 'Move Stargazing' }).focus()
  await guest.keyboard.press('ArrowDown')
  await expect(group.locator('[data-card-id]')).toContainText('Stargazing')
  await expect(guest.getByRole('button', { name: 'Move Stargazing' })).toBeFocused()
  await guest.keyboard.press('ArrowUp')
  await expect(group.locator('[data-card-id]')).toHaveCount(0)

  await guestContext.close()
})
