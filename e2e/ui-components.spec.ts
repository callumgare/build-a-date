import type { Locator } from '@playwright/test'
import { expect, test } from './fixtures'
import { createDeck, signUp } from './helpers'

function textShadow(element: Locator) {
  return element.evaluate((node) => getComputedStyle(node).textShadow)
}

function underline(element: Locator) {
  return element.evaluate((node) => {
    const style = getComputedStyle(node)
    return { line: style.textDecorationLine, colour: style.textDecorationColor, text: style.color }
  })
}

/** @see docs/ui-components.md § "The text halo" */
test('text on the background has the halo, and text on anything with a background of its own does not', async ({
  page,
}) => {
  await page.goto('/sample')
  expect(await textShadow(page.locator('[data-hero] h1'))).not.toBe('none')
  expect(await textShadow(page.getByRole('button', { name: 'Draw random card' }))).not.toBe('none')
  expect(await textShadow(page.getByRole('button', { name: 'All', exact: true }))).toBe('none')
  const card = page.locator('[data-deck-card-id]').first()
  expect(await textShadow(card.locator('span').filter({ hasText: /\w/ }).last())).toBe('none')

  await page.goto('/sign-in')
  expect(await textShadow(page.getByRole('link', { name: 'Sign up' }))).not.toBe('none')
  expect(await textShadow(page.getByRole('heading', { name: 'Sign in' }))).toBe('none')
  expect(await textShadow(page.getByRole('link', { name: 'Make an account' }))).toBe('none')
})

/** @see docs/ui-components.md § "Links and buttons" */
test('every text button and link has a faint underline that firms up on hover', async ({ page, request }) => {
  await signUp(page, request, 'Underline')
  await createDeck(page, 'Underlines')

  const addIdea = page.getByRole('button', { name: 'Add an idea' })
  const deleteDeck = page.getByRole('button', { name: 'Delete deck' })
  const atRest = await underline(addIdea)
  expect(atRest.line).toBe('underline')
  expect(atRest.colour).not.toBe(atRest.text)
  expect(await underline(deleteDeck)).toEqual(atRest)

  for (const element of [addIdea, deleteDeck]) {
    await element.hover()
    const hovered = await underline(element)
    expect(hovered.colour).toBe(hovered.text)
  }

  // Inside a dialog too, which has no halo.
  await addIdea.click()
  const dialog = page.getByRole('dialog', { name: 'Edit idea' })
  expect(await textShadow(dialog.getByRole('heading', { name: 'New idea' }))).toBe('none')
  expect(await underline(dialog.getByRole('button', { name: 'Cancel' }))).toMatchObject({ line: 'underline' })
})
