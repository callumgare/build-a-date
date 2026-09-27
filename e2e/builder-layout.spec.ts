import type { APIRequestContext, Browser, Locator, Page } from '@playwright/test'
import { expect, newVisitor, test } from './fixtures'
import { createDeck, signUp } from './helpers'

function zoomOf(section: Locator) {
  return section.evaluate((element) => getComputedStyle(element).zoom)
}

// Whether the section's zoom animated after a click on a spot: a CSS
// transition on it, rather than a jump, however slowly frames come.
async function zoomAnimatesAfterClick(page: Page, section: Locator, x: number, y: number) {
  const animated = section.evaluate(
    (element) =>
      new Promise<boolean>((resolve) => {
        const until = performance.now() + 900
        requestAnimationFrame(function watch(time) {
          const zooming = element
            .getAnimations()
            .some((animation) => (animation as CSSTransition).transitionProperty === 'zoom')
          if (zooming) resolve(true)
          else if (time < until) requestAnimationFrame(watch)
          else resolve(false)
        })
      }),
  )
  await page.mouse.click(x, y)
  return animated
}

/** @see docs/card-layout.md § "The plan column" */
test('the plan is a column beside the deck, and stays in the window as the deck scrolls', async ({
  page,
  browser,
  request,
}) => {
  await signUp(page, request, 'Alex')
  const shareUrl = await createDeck(page, 'Ideas for Sam')

  const guestContext = await newVisitor(browser)
  const guest = await guestContext.newPage()
  await guest.setViewportSize({ width: 1280, height: 800 })
  await guest.goto(shareUrl)
  const plan = guest.getByRole('region', { name: 'Your plan' })
  const deck = guest.getByRole('region', { name: 'Date ideas' })
  const planBox = await plan.boundingBox()
  const deckBox = await deck.boundingBox()
  if (!planBox || !deckBox) throw new Error('Builder has no size')
  expect(planBox.x + planBox.width).toBeLessThanOrEqual(deckBox.x)
  expect(planBox.width).toBeLessThan(deckBox.width / 2)

  // Part way down the deck, not so far that the builder's end comes up.
  await guest.mouse.wheel(0, 1500)
  // Stuck to the top of the window, while the bar with Save plan scrolls
  // away with the page.
  await expect.poll(async () => (await guest.locator('.plan-column').boundingBox())?.y).toBe(0)
  expect((await guest.locator('.builder-bar').boundingBox())?.y).toBeLessThan(-100)

  await guestContext.close()
})

/** @see docs/card-layout.md § "Narrow screens" */
test('on a narrow screen one column is in use, and a click on the other puts it in use', async ({
  page,
  browser,
  request,
}) => {
  await signUp(page, request, 'Alex')
  const shareUrl = await createDeck(page, 'Ideas for Sam')

  const guestContext = await newVisitor(browser)
  const guest = await guestContext.newPage()
  await guest.setViewportSize({ width: 420, height: 860 })
  await guest.goto(shareUrl)
  const plan = guest.getByRole('region', { name: 'Your plan' })
  const deck = guest.getByRole('region', { name: 'Date ideas' })
  await expect.poll(() => zoomOf(plan)).toBe('0.2')
  expect(await zoomOf(deck)).toBe('1')

  // Picked from the deck, into the shrunk plan.
  await guest.locator('[data-deck-card-id]').filter({ hasText: 'Stargazing' }).hover()
  await guest.getByRole('button', { name: 'Add to plan: Stargazing' }).click()
  await expect(guest.locator('[data-card-id]')).toContainText('Stargazing')

  // A click right on the card in the shrunk plan puts the plan in use,
  // rather than discarding the card, growing it bit by bit.
  await expect(guest.locator('.plan-column [data-card-id]')).toBeVisible()
  const cardBox = await guest.locator('[data-card-id]').boundingBox()
  if (!cardBox) throw new Error('Card has no size')
  expect(
    await zoomAnimatesAfterClick(guest, plan, cardBox.x + cardBox.width * 0.25, cardBox.y + cardBox.height / 2),
  ).toBe(true)
  await expect.poll(() => zoomOf(plan)).toBe('1')
  expect(await zoomOf(deck)).toBe('0.2')
  await expect(guest.locator('[data-card-id]')).toHaveCount(1)
  await expect(guest.getByRole('button', { name: 'Save plan' })).toBeVisible()

  // And back, from a click on the shrunk deck, once the switch is over and
  // the page has stopped keeping the deck's place.
  await guest.waitForTimeout(700)
  const deckBox = await guest.locator('.deck-column').boundingBox()
  if (!deckBox) throw new Error('Deck has no size')
  expect(await zoomAnimatesAfterClick(guest, plan, deckBox.x + deckBox.width / 2, Math.max(deckBox.y, 0) + 40)).toBe(
    true,
  )
  await expect.poll(() => zoomOf(deck)).toBe('1')
  expect(await zoomOf(plan)).toBe('0.2')

  await guestContext.close()
})

/** @see docs/card-layout.md § "Narrow screens" - click to switch, and back to the same place */
test('on a narrow screen a click under the shrunk plan puts it in use, and the deck comes back where it was', async ({
  page,
  browser,
  request,
}) => {
  await signUp(page, request, 'Alex')
  const shareUrl = await createDeck(page, 'Ideas for Sam')

  const guestContext = await newVisitor(browser)
  const guest = await guestContext.newPage()
  await guest.setViewportSize({ width: 420, height: 860 })
  await guest.goto(shareUrl)
  const plan = guest.getByRole('region', { name: 'Your plan' })
  const deck = guest.getByRole('region', { name: 'Date ideas' })
  await expect.poll(() => zoomOf(plan)).toBe('0.2')

  await guest.evaluate(() => window.scrollTo(0, 3000))
  await expect.poll(() => guest.evaluate(() => window.scrollY)).toBe(3000)

  // Well under the shrunk plan's slot, near the bottom of the window.
  const columnBox = await guest.locator('.plan-column').boundingBox()
  const planBox = await plan.boundingBox()
  if (!columnBox || !planBox) throw new Error('Plan has no size')
  expect(planBox.y + planBox.height).toBeLessThan(800)
  await guest.mouse.click(columnBox.x + columnBox.width / 2, 840)
  await expect.poll(() => zoomOf(plan)).toBe('1')

  await guest.getByRole('button', { name: 'Show the date ideas' }).click()
  await expect.poll(() => zoomOf(deck)).toBe('1')
  await expect.poll(() => guest.evaluate(() => window.scrollY)).toBe(3000)

  await guestContext.close()
})

/** @see docs/card-layout.md § "Narrow screens" - the last column used */
test('narrowing the window keeps the column used last in use', async ({ page, browser, request }) => {
  await signUp(page, request, 'Alex')
  const shareUrl = await createDeck(page, 'Ideas for Sam')

  const guestContext = await newVisitor(browser)
  const guest = await guestContext.newPage()
  await guest.setViewportSize({ width: 1280, height: 800 })
  await guest.goto(shareUrl)
  const plan = guest.getByRole('region', { name: 'Your plan' })
  const deck = guest.getByRole('region', { name: 'Date ideas' })

  await guest.getByRole('button', { name: 'Add group' }).click()
  await guest.setViewportSize({ width: 420, height: 860 })
  await expect.poll(() => zoomOf(deck)).toBe('0.2')
  expect(await zoomOf(plan)).toBe('1')

  await guest.setViewportSize({ width: 1280, height: 800 })
  await guest.getByRole('button', { name: 'Random', exact: true }).click()
  await guest.setViewportSize({ width: 420, height: 860 })
  await expect.poll(() => zoomOf(plan)).toBe('0.2')
  expect(await zoomOf(deck)).toBe('1')

  await guestContext.close()
})

/** @see docs/card-layout.md § "Save plan and Clear plan" - readable */
test('the bar above the columns has no background, and its words have the halo', async ({ page, browser, request }) => {
  await signUp(page, request, 'Alex')
  const shareUrl = await createDeck(page, 'Ideas for Sam')

  const guestContext = await newVisitor(browser)
  const guest = await guestContext.newPage()
  await guest.goto(shareUrl)
  const bar = guest.locator('.builder-bar')
  const style = (locator: Locator) =>
    locator.evaluate((element) => {
      const computed = getComputedStyle(element)
      return { background: computed.backgroundColor, image: computed.backgroundImage, halo: computed.textShadow }
    })

  expect(await style(bar)).toMatchObject({ background: 'rgba(0, 0, 0, 0)', image: 'none' })
  expect((await style(bar.getByText('Pick a card from the deck'))).halo).not.toBe('none')

  await guest.getByRole('button', { name: 'Draw random card' }).click()
  expect((await style(bar.getByRole('button', { name: 'Clear plan' }))).halo).not.toBe('none')

  await guestContext.close()
})

// Picks a card from inside the page, having noted where each watched element
// was, then notes where each is drawn, frame by frame, as the card comes in.
function pickAndWatch(page: Page, watched: Record<string, string>) {
  return page.evaluate(
    (watched) =>
      new Promise<Record<string, { before: number; ys: number[] }>>((resolve) => {
        const y = (selector: string) => document.querySelector(selector)?.getBoundingClientRect().y ?? Number.NaN
        const seen = Object.fromEntries(
          Object.entries(watched).map(([name, selector]) => [name, { before: y(selector), ys: [] as number[] }]),
        )
        document.querySelector<HTMLElement>('[data-deck-card-id] button[aria-label^="Add to plan"]')?.click()
        const until = performance.now() + 900
        requestAnimationFrame(function watch(time) {
          for (const [name, selector] of Object.entries(watched)) seen[name].ys.push(y(selector))
          if (time < until) requestAnimationFrame(watch)
          else resolve(seen)
        })
      }),
    watched,
  )
}

/** @see docs/card-layout.md § "The plan column" - sliding out of the way, and § "Narrow screens" */
for (const size of ['wide', 'narrow'] as const) {
  test(`on a ${size} screen Draw random card, groups and Add group slide down out of the way of a card coming in`, async ({
    page,
    browser,
    request,
  }) => {
    await signUp(page, request, 'Alex')
    const shareUrl = await createDeck(page, 'Ideas for Sam')

    const guestContext = await newVisitor(browser)
    const guest = await guestContext.newPage()
    await guest.setViewportSize({ width: 1280, height: 1600 })
    await guest.goto(shareUrl)
    await guest.getByRole('button', { name: 'Draw random card' }).click()
    await guest.getByRole('button', { name: 'Add group' }).click()
    if (size === 'narrow') {
      // The deck in use, so the plan the card comes into is shrunk.
      await guest.setViewportSize({ width: 420, height: 860 })
      await guest.getByRole('button', { name: 'Show the date ideas' }).click()
      await expect.poll(() => zoomOf(guest.getByRole('region', { name: 'Your plan' }))).toBe('0.2')
    }
    await guest.waitForTimeout(800)

    const places = await pickAndWatch(guest, {
      random: '.random-pick',
      group: '.plan-column .plan-group',
      addGroup: '.plan-group-add',
    })
    for (const [name, { before, ys }] of Object.entries(places)) {
      const distinct = new Set(ys.map(Math.round))
      const moved = ys[ys.length - 1] - before
      expect(moved, `${name} moved down`).toBeGreaterThan(size === 'wide' ? 100 : 20)
      expect(distinct.size, `${name} went through ${[...distinct].join(', ')}`).toBeGreaterThan(4)
      // Starting from where it was, not most of the way there already.
      expect(ys[0] - before, `${name} started at ${ys[0]}, from ${before}`).toBeLessThan(moved * 0.35)
      // Only ever downwards.
      expect(ys, name).toEqual([...ys].sort((a, b) => a - b))
    }

    await guestContext.close()
  })
}

/** @see docs/card-layout.md § "Save plan and Clear plan" - how to start */
test('the prompt and the buttons fade into each other', async ({ page, browser, request }) => {
  await signUp(page, request, 'Alex')
  const shareUrl = await createDeck(page, 'Ideas for Sam')

  const guestContext = await newVisitor(browser)
  const guest = await guestContext.newPage()
  await guest.goto(shareUrl)

  // The opacity of the prompt and the buttons, frame by frame, after a click.
  async function fadesAfter(button: string) {
    return guest.evaluate(
      (button) =>
        new Promise<{ prompt: number[]; buttons: number[] }>((resolve) => {
          const opacity = (element: Element | null | undefined) =>
            element ? Number(getComputedStyle(element).opacity) : -1
          const seen = { prompt: [] as number[], buttons: [] as number[] }
          ;[...document.querySelectorAll<HTMLElement>('button')].find((each) => each.textContent === button)?.click()
          const until = performance.now() + 600
          requestAnimationFrame(function watch(time) {
            const contents = [...document.querySelectorAll('.builder-bar-content')]
            seen.prompt.push(opacity(contents.find((each) => each.querySelector('.plan-prompt'))))
            seen.buttons.push(opacity(contents.find((each) => each.querySelector('.plan-actions'))))
            if (time < until) requestAnimationFrame(watch)
            else resolve(seen)
          })
        }),
      button,
    )
  }
  const between = (values: number[]) => values.filter((value) => value > 0.05 && value < 0.95).length

  const picked = await fadesAfter('Draw random card')
  expect(between(picked.prompt), `prompt: ${picked.prompt.join(', ')}`).toBeGreaterThan(2)
  expect(between(picked.buttons), `buttons: ${picked.buttons.join(', ')}`).toBeGreaterThan(2)
  expect(picked.prompt.at(-1)).toBe(-1)
  expect(picked.buttons.at(-1)).toBe(1)

  const cleared = await fadesAfter('Clear plan')
  expect(between(cleared.prompt), `prompt: ${cleared.prompt.join(', ')}`).toBeGreaterThan(2)
  expect(between(cleared.buttons), `buttons: ${cleared.buttons.join(', ')}`).toBeGreaterThan(2)
  expect(cleared.buttons.at(-1)).toBe(-1)
  expect(cleared.prompt.at(-1)).toBe(1)

  await guestContext.close()
})

// Where each card in the plan's first row is drawn.
function planCardBoxes(page: Page) {
  return page
    .locator('.plan-track')
    .first()
    .locator(':scope > [data-card-id]')
    .evaluateAll((cards) =>
      // Offsets, which a hovered card's tilt doesn't move.
      cards.map((card) => {
        const element = card as HTMLElement
        return { id: element.dataset.cardId ?? '', x: element.offsetLeft, y: element.offsetTop }
      }),
    )
}

async function narrowPlanOfThree(page: Page, browser: Browser, request: APIRequestContext, width: number) {
  await signUp(page, request, 'Alex')
  const shareUrl = await createDeck(page, 'Ideas for Sam')
  const guestContext = await newVisitor(browser)
  const guest = await guestContext.newPage()
  await guest.setViewportSize({ width: 1280, height: 900 })
  await guest.goto(shareUrl)
  for (let picked = 1; picked <= 3; picked++) {
    await guest.getByRole('button', { name: 'Draw random card' }).click()
    await expect(guest.locator('[data-card-id]')).toHaveCount(picked)
  }
  // Last used the plan, so it's in use once the window is narrow.
  await guest.setViewportSize({ width, height: 900 })
  await expect.poll(() => zoomOf(guest.getByRole('region', { name: 'Your plan' }))).toBe('1')
  await guest.waitForTimeout(700)
  return { guest, guestContext }
}

/** @see docs/card-layout.md § "Narrow screens" - the plan in a grid */
test('on a narrow screen with room, the plan in use is a grid like the deck', async ({ page, browser, request }) => {
  const { guest, guestContext } = await narrowPlanOfThree(page, browser, request, 860)
  const boxes = await planCardBoxes(guest)
  // Side by side, like the deck when it's in use.
  expect(boxes[1].y).toBe(boxes[0].y)
  expect(boxes[1].x).toBeGreaterThan(boxes[0].x)

  await guestContext.close()
})

/** @see docs/card-layout.md § "Narrow screens" - the plan in a grid */
test('on a narrow screen without room, the plan in use is one column', async ({ page, browser, request }) => {
  const { guest, guestContext } = await narrowPlanOfThree(page, browser, request, 420)
  const boxes = await planCardBoxes(guest)
  expect(new Set(boxes.map((box) => box.x)).size).toBe(1)
  expect(boxes[1].y).toBeGreaterThan(boxes[0].y)
  expect(boxes[2].y).toBeGreaterThan(boxes[1].y)

  await guestContext.close()
})

/** @see docs/card-layout.md § "Reordering the plan" - by dragging it */
test('a card is dragged along a line of the plan when it is a grid', async ({ page, browser, request }) => {
  const { guest, guestContext } = await narrowPlanOfThree(page, browser, request, 860)
  const [first, second] = await planCardBoxes(guest)
  const card = guest.locator(`[data-card-id="${first.id}"]`)
  const box = await card.boundingBox()
  const secondBox = await guest.locator(`[data-card-id="${second.id}"]`).boundingBox()
  if (!box || !secondBox) throw new Error('Cards have no size')

  // Sideways, past the middle of the card beside it.
  const y = box.y + box.height / 2
  await card.hover()
  await guest.mouse.move(box.x + box.width / 2, y)
  await guest.mouse.down()
  await guest.mouse.move(secondBox.x + secondBox.width * 0.8, y, { steps: 20 })
  await guest.mouse.up()
  await expect
    .poll(async () => (await planCardBoxes(guest)).map((each) => each.id).slice(0, 2))
    .toEqual([second.id, first.id])

  await guestContext.close()
})

/** @see docs/card-layout.md § "The plan column" - scrolling over it */
test('scrolling over the plan scrolls the page when it fits, and the plan first when it does not', async ({
  page,
  browser,
  request,
}) => {
  await signUp(page, request, 'Alex')
  const shareUrl = await createDeck(page, 'Ideas for Sam')
  const guestContext = await newVisitor(browser)
  const guest = await guestContext.newPage()
  await guest.setViewportSize({ width: 1280, height: 800 })
  await guest.goto(shareUrl)
  const column = guest.locator('.plan-scroll')
  const box = await column.boundingBox()
  if (!box) throw new Error('No plan column')
  const scrollY = () => guest.evaluate(() => window.scrollY)

  // Nothing picked, so the plan fits: the page scrolls.
  await guest.mouse.move(box.x + box.width / 2, box.y + 100)
  await guest.mouse.wheel(0, 300)
  await expect.poll(scrollY).toBeGreaterThan(200)

  // Taller than the window: the plan scrolls to its end first.
  await guest.evaluate(() => window.scrollTo(0, 0))
  for (let picked = 1; picked <= 4; picked++) {
    await guest.getByRole('button', { name: 'Draw random card' }).click()
    await expect(guest.locator('[data-card-id]')).toHaveCount(picked)
  }
  await guest.waitForTimeout(800)
  await column.evaluate((element) => {
    element.scrollTop = 0
    window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY)
  })
  const pageBefore = await scrollY()
  const stuck = await column.boundingBox()
  if (!stuck) throw new Error('No plan column')
  await guest.mouse.move(stuck.x + stuck.width / 2, stuck.y + 300)
  await guest.mouse.wheel(0, 200)
  await expect.poll(() => column.evaluate((element) => element.scrollTop)).toBeGreaterThan(100)
  expect(await scrollY()).toBe(pageBefore)

  // Once it's at its end, the next scroll moves the page.
  await column.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  await guest.waitForTimeout(300)
  await guest.mouse.wheel(0, 300)
  await expect.poll(scrollY).toBeGreaterThan(pageBefore + 100)

  await guestContext.close()
})

/** @see docs/card-layout.md § "The plan column" - the title, and fading out */
for (const opened of ['as picked', 'after a reload, with the picks kept']) {
  test(`the plan has its title above it, and fades out where it is scrolled out of sight, ${opened}`, async ({
    page,
    browser,
    request,
  }) => {
    await signUp(page, request, 'Alex')
    const shareUrl = await createDeck(page, 'Ideas for Sam')
    const guestContext = await newVisitor(browser)
    const guest = await guestContext.newPage()
    await guest.setViewportSize({ width: 1280, height: 800 })
    await guest.goto(shareUrl)
    for (let picked = 1; picked <= 4; picked++) {
      await guest.getByRole('button', { name: 'Draw random card' }).click()
      await expect(guest.locator('[data-card-id]')).toHaveCount(picked)
    }
    // Kept picks lay the plan out afresh, with a new element that scrolls.
    if (opened !== 'as picked') {
      await guest.reload()
      await expect(guest.locator('[data-card-id]')).toHaveCount(4)
    }
    await guest.waitForTimeout(800)
    const scroller = guest.locator('.plan-scroll')
    const title = guest.getByRole('heading', { name: 'The Plan' })
    // Stuck at the top of the window, the title above the plan.
    await scroller.evaluate((element) => {
      element.scrollTop = 0
      window.scrollTo(0, (element.parentElement as HTMLElement).getBoundingClientRect().top + window.scrollY)
    })
    const ends = () =>
      scroller.evaluate((element) => ({
        above: element.hasAttribute('data-more-above'),
        below: element.hasAttribute('data-more-below'),
      }))
    const fade = (property: '--fade-top' | '--fade-bottom') =>
      scroller.evaluate((element, property) => getComputedStyle(element).getPropertyValue(property), property)

    await expect.poll(ends).toEqual({ above: false, below: true })
    await expect.poll(() => fade('--fade-bottom')).toBe('48px')
    await expect.poll(() => fade('--fade-top')).toBe('0px')
    const titleAt = (await title.boundingBox())?.y

    // Part way down, both ends fade; the title hasn't moved.
    await scroller.evaluate((element) => {
      element.scrollTop = 200
    })
    await expect.poll(ends).toEqual({ above: true, below: true })
    await expect(title).toBeVisible()
    expect((await title.boundingBox())?.y).toBe(titleAt)

    // At the end, only the top.
    await scroller.evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })
    await expect.poll(ends).toEqual({ above: true, below: false })
    await expect.poll(() => fade('--fade-bottom')).toBe('0px')

    await guestContext.close()
  })
}

/** @see docs/card-layout.md § "The grid of cards" */
test("a line of cards that isn't full is in the middle, and Draw random card sits a little apart", async ({
  page,
  browser,
  request,
}) => {
  const { guest, guestContext } = await narrowPlanOfThree(page, browser, request, 860)
  const columns = await guest
    .locator('.plan-track')
    .first()
    .evaluate((element) => Number.parseInt(getComputedStyle(element).getPropertyValue('--columns'), 10))
  // One more card than fits on a line, so the last is alone on the next.
  for (let picked = 4; picked <= columns + 1; picked++) {
    await guest.getByRole('button', { name: 'Draw random card' }).click()
    await expect(guest.locator('[data-card-id]')).toHaveCount(picked)
  }
  await guest.waitForTimeout(800)
  const boxes = await planCardBoxes(guest)
  expect(columns).toBeGreaterThan(1)
  const last = boxes[columns]
  expect(last.y).toBeGreaterThan(boxes[0].y)
  const track = await guest
    .locator('.plan-track')
    .first()
    .evaluate((element) => (element as HTMLElement).offsetWidth)
  const width = await guest
    .locator('[data-card-id]')
    .first()
    .evaluate((element) => (element as HTMLElement).offsetWidth)
  expect(Math.abs(last.x + width / 2 - track / 2)).toBeLessThan(2)

  // More room above Draw random card than between the cards.
  const gap = await guest.evaluate(() => {
    const cards = [...document.querySelectorAll<HTMLElement>('.plan-track [data-card-id]')]
    const lastCard = cards[cards.length - 1].getBoundingClientRect()
    const link = (document.querySelector('.random-pick') as HTMLElement).getBoundingClientRect()
    return link.top - lastCard.bottom
  })
  expect(gap).toBeGreaterThan(20)

  await guestContext.close()
})

/** @see docs/card-layout.md § "Narrow screens" - cards still slide */
test('with the plan shrunk, a second card picked makes room by sliding the first over', async ({
  page,
  browser,
  request,
}) => {
  await signUp(page, request, 'Alex')
  const shareUrl = await createDeck(page, 'Ideas for Sam')
  const guestContext = await newVisitor(browser)
  const guest = await guestContext.newPage()
  await guest.setViewportSize({ width: 860, height: 900 })
  await guest.goto(shareUrl)
  const pick = () =>
    guest.evaluate(() =>
      document.querySelector<HTMLElement>('[data-deck-card-id] button[aria-label^="Add to plan"]')?.click(),
    )
  await pick()
  await expect(guest.locator('[data-card-id]')).toHaveCount(1)
  await guest.waitForTimeout(900)
  expect(
    await guest
      .locator('.plan-track')
      .first()
      .evaluate((element) => Number.parseInt(getComputedStyle(element).getPropertyValue('--columns'), 10)),
  ).toBeGreaterThan(1)

  // The first card, within its row, frame by frame as the second comes in.
  await guest.evaluate(() => {
    const first = document.querySelector('[data-card-id]') as HTMLElement
    const xs: number[] = []
    ;(window as unknown as { xs: number[] }).xs = xs
    const until = performance.now() + 1200
    requestAnimationFrame(function watch(time) {
      xs.push(first.getBoundingClientRect().x - (first.parentElement as HTMLElement).getBoundingClientRect().x)
      if (time < until) requestAnimationFrame(watch)
    })
  })
  await pick()
  await guest.waitForTimeout(1300)
  const xs = await guest.evaluate(() => (window as unknown as { xs: number[] }).xs)
  const distinct = new Set(xs.map((x) => Math.round(x)))
  expect(distinct.size, [...distinct].join(', ')).toBeGreaterThan(4)
  expect(xs[xs.length - 1]).toBeLessThan(xs[0])
  // Only ever to the left, without overshooting its place.
  expect(xs).toEqual([...xs].sort((a, b) => b - a))

  await guestContext.close()
})
