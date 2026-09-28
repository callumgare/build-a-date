import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures'

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
test('the plan is a column to the right of the deck, and stays in the window as the deck scrolls', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/sample')
  const plan = page.getByRole('region', { name: 'Your plan' })
  const deck = page.getByRole('region', { name: 'Date ideas' })
  const planBox = await plan.boundingBox()
  const deckBox = await deck.boundingBox()
  if (!planBox || !deckBox) throw new Error('Builder has no size')
  expect(deckBox.x + deckBox.width).toBeLessThanOrEqual(planBox.x)
  expect(planBox.width).toBeLessThan(deckBox.width / 2)

  // Part way down the deck, not so far that the builder's end comes up.
  await page.mouse.wheel(0, 1500)
  // Stuck to the top of the window, while the bar with Save plan scrolls
  // away with the page.
  await expect.poll(async () => (await page.locator('.plan-column').boundingBox())?.y).toBe(0)
  expect((await page.locator('.builder-bar').boundingBox())?.y).toBeLessThan(-100)
})

/** @see docs/card-layout.md § "The plan column" - the page's title */
test('the title and what is under it are centred, one above the other, and so is a group in the plan', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/sample')
  const middle = (box: { x: number; width: number } | null) => (box ? box.x + box.width / 2 : Number.NaN)
  const title = await page.locator('.hero h1').boundingBox()
  const lede = await page.locator('.hero .lede').boundingBox()
  const pageBox = await page.locator('main').boundingBox()
  if (!title || !lede || !pageBox) throw new Error('Hero has no size')
  expect(lede.y).toBeGreaterThanOrEqual(title.y + title.height - 1)
  expect(Math.abs(middle(title) - middle(pageBox))).toBeLessThan(2)
  expect(Math.abs(middle(lede) - middle(pageBox))).toBeLessThan(2)

  // docs/plans.md § "Groups" - the title and notes centred above its cards.
  await page.getByRole('button', { name: 'Add group' }).click()
  const group = page.getByRole('region', { name: 'Group 1' })
  const track = await group.locator('.plan-group-track').boundingBox()
  for (const part of [
    group.getByRole('textbox', { name: 'Title of Group 1' }),
    group.getByRole('button', { name: 'Remove Group 1' }),
  ]) {
    expect(Math.abs(middle(await part.boundingBox()) - middle(track))).toBeLessThan(2)
  }
  for (const field of ['.plan-group-title', '.plan-group-notes']) {
    expect(await group.locator(field).evaluate((element) => getComputedStyle(element).textAlign)).toBe('center')
  }
})

/** @see docs/card-layout.md § "Narrow screens" */
test('on a narrow screen one column is in use, and a click on the other puts it in use', async ({ page }) => {
  await page.setViewportSize({ width: 420, height: 860 })
  await page.goto('/sample')
  const plan = page.getByRole('region', { name: 'Your plan' })
  const deck = page.getByRole('region', { name: 'Date ideas' })
  await expect.poll(() => zoomOf(plan)).toBe('0.2')
  expect(await zoomOf(deck)).toBe('1')

  // Picked from the deck, into the shrunk plan.
  await page.locator('[data-deck-card-id]').filter({ hasText: 'Stargazing' }).hover()
  await page.getByRole('button', { name: 'Add to plan: Stargazing' }).click()
  await expect(page.locator('[data-card-id]')).toContainText('Stargazing')

  // A click right on the card in the shrunk plan puts the plan in use,
  // rather than discarding the card, growing it bit by bit.
  await expect(page.locator('.plan-column [data-card-id]')).toBeVisible()
  const cardBox = await page.locator('[data-card-id]').boundingBox()
  if (!cardBox) throw new Error('Card has no size')
  expect(
    await zoomAnimatesAfterClick(page, plan, cardBox.x + cardBox.width * 0.25, cardBox.y + cardBox.height / 2),
  ).toBe(true)
  await expect.poll(() => zoomOf(plan)).toBe('1')
  expect(await zoomOf(deck)).toBe('0.2')
  await expect(page.locator('[data-card-id]')).toHaveCount(1)
  await expect(page.getByRole('link', { name: 'Create your own deck' })).toBeVisible()

  // And back, from a click on the shrunk deck, once the switch is over and
  // the page has stopped keeping the deck's place.
  await page.waitForTimeout(700)
  const deckBox = await page.locator('.deck-column').boundingBox()
  if (!deckBox) throw new Error('Deck has no size')
  expect(await zoomAnimatesAfterClick(page, plan, deckBox.x + deckBox.width / 2, Math.max(deckBox.y, 0) + 40)).toBe(
    true,
  )
  await expect.poll(() => zoomOf(deck)).toBe('1')
  expect(await zoomOf(plan)).toBe('0.2')
})

/** @see docs/card-layout.md § "Narrow screens" - click to switch, and back to the same place */
test('on a narrow screen a click under the shrunk plan puts it in use, and the deck comes back where it was', async ({
  page,
}) => {
  await page.setViewportSize({ width: 420, height: 860 })
  await page.goto('/sample')
  const plan = page.getByRole('region', { name: 'Your plan' })
  const deck = page.getByRole('region', { name: 'Date ideas' })
  await expect.poll(() => zoomOf(plan)).toBe('0.2')

  await page.evaluate(() => window.scrollTo(0, 3000))
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(3000)

  // Well under the shrunk plan's slot, near the bottom of the window.
  const columnBox = await page.locator('.plan-column').boundingBox()
  const planBox = await plan.boundingBox()
  if (!columnBox || !planBox) throw new Error('Plan has no size')
  expect(planBox.y + planBox.height).toBeLessThan(800)
  await page.mouse.click(columnBox.x + columnBox.width / 2, 840)
  await expect.poll(() => zoomOf(plan)).toBe('1')

  await page.getByRole('button', { name: 'Show the date ideas' }).click()
  await expect.poll(() => zoomOf(deck)).toBe('1')
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(3000)
})

/** @see docs/card-layout.md § "Narrow screens" - the last column used */
test('narrowing the window keeps the column used last in use', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/sample')
  const plan = page.getByRole('region', { name: 'Your plan' })
  const deck = page.getByRole('region', { name: 'Date ideas' })

  await page.getByRole('button', { name: 'Add group' }).click()
  await page.setViewportSize({ width: 420, height: 860 })
  await expect.poll(() => zoomOf(deck)).toBe('0.2')
  expect(await zoomOf(plan)).toBe('1')

  await page.setViewportSize({ width: 1280, height: 800 })
  await page.getByRole('button', { name: 'Random', exact: true }).click()
  await page.setViewportSize({ width: 420, height: 860 })
  await expect.poll(() => zoomOf(plan)).toBe('0.2')
  expect(await zoomOf(deck)).toBe('1')
})

/** @see docs/card-layout.md § "Save plan and Clear plan" - how to start: the bar keeps its height either way */
test("the bar keeps its height when the buttons come in, so the page doesn't move", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 860 })
  await page.goto('/sample')
  const bar = page.locator('.builder-bar')
  const before = await bar.evaluate((element) => element.getBoundingClientRect().height)
  const card = page.locator('[data-deck-card-id]').first()
  await card.hover()
  await card.getByRole('button', { name: /^Add to plan: / }).click()
  await expect(page.getByRole('button', { name: 'Clear plan' })).toBeVisible()
  await expect.poll(() => bar.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0)
  expect(await bar.evaluate((element) => element.getBoundingClientRect().height)).toBe(before)
})

/** @see docs/card-layout.md § "Save plan and Clear plan" - readable */
test('the bar above the columns has no background, and its words have the halo', async ({ page }) => {
  await page.goto('/sample')
  const bar = page.locator('.builder-bar')
  const style = (locator: Locator) =>
    locator.evaluate((element) => {
      const computed = getComputedStyle(element)
      return { background: computed.backgroundColor, image: computed.backgroundImage, halo: computed.textShadow }
    })

  expect(await style(bar)).toMatchObject({ background: 'rgba(0, 0, 0, 0)', image: 'none' })
  expect((await style(bar.getByText('Pick a card from the deck'))).halo).not.toBe('none')

  await page.getByRole('button', { name: 'Draw random card' }).click()
  expect((await style(bar.getByRole('button', { name: 'Clear plan' }))).halo).not.toBe('none')
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
  }) => {
    await page.setViewportSize({ width: 1280, height: 1600 })
    await page.goto('/sample')
    await page.getByRole('button', { name: 'Draw random card' }).click()
    await page.getByRole('button', { name: 'Add group' }).click()
    if (size === 'narrow') {
      // The deck in use, so the plan the card comes into is shrunk.
      await page.setViewportSize({ width: 420, height: 860 })
      await page.getByRole('button', { name: 'Show the date ideas' }).click()
      await expect.poll(() => zoomOf(page.getByRole('region', { name: 'Your plan' }))).toBe('0.2')
    }
    await page.waitForTimeout(800)

    const places = await pickAndWatch(page, {
      random: '.random-pick',
      group: '.plan-column .plan-group',
      addGroup: '.plan-group-add',
    })
    for (const [name, { before, ys }] of Object.entries(places)) {
      const distinct = new Set(ys.map(Math.round))
      const moved = ys[ys.length - 1] - before
      expect(moved, `${name} moved down`).toBeGreaterThan(size === 'wide' ? 100 : 20)
      // Some frames part way, however few a busy machine draws.
      expect(distinct.size, `${name} went through ${[...distinct].join(', ')}`).toBeGreaterThan(2)
      // Starting from where it was, not most of the way there already.
      expect(ys[0] - before, `${name} started at ${ys[0]}, from ${before}`).toBeLessThan(moved * 0.35)
      // Only ever downwards.
      expect(ys, name).toEqual([...ys].sort((a, b) => a - b))
    }
  })
}

/** @see docs/card-layout.md § "Save plan and Clear plan" - how to start */
test('the prompt and the buttons fade into each other', async ({ page }) => {
  await page.goto('/sample')

  // The opacity of the prompt and the buttons, frame by frame, after a click.
  async function fadesAfter(button: string) {
    return page.evaluate(
      (button) =>
        new Promise<{ prompt: number[]; buttons: number[]; fading: { prompt: boolean; buttons: boolean } }>(
          (resolve) => {
            const opacity = (element: Element | null | undefined) =>
              element ? Number(getComputedStyle(element).opacity) : -1
            const seen = { prompt: [] as number[], buttons: [] as number[] }
            // Whether each was part way faded on any frame, or had an opacity
            // animation running: on a busy machine a quarter of a second's fade
            // may not get a frame drawn part way through.
            const fading = { prompt: false, buttons: false }
            const fadingNow = (element: Element | undefined) => {
              if (!element) return false
              const value = opacity(element)
              const animating = element
                .getAnimations()
                .some((animation) =>
                  ((animation.effect as KeyframeEffect | null)?.getKeyframes() ?? []).some(
                    (frame) => 'opacity' in frame,
                  ),
                )
              return animating || (value > 0.05 && value < 0.95)
            }
            ;[...document.querySelectorAll<HTMLElement>('button')].find((each) => each.textContent === button)?.click()
            const until = performance.now() + 1500
            requestAnimationFrame(function watch(time) {
              const contents = [...document.querySelectorAll('.builder-bar-content')]
              const prompt = contents.find((each) => each.querySelector('.plan-prompt'))
              const buttons = contents.find((each) => each.querySelector('.plan-actions'))
              seen.prompt.push(opacity(prompt))
              seen.buttons.push(opacity(buttons))
              fading.prompt ||= fadingNow(prompt)
              fading.buttons ||= fadingNow(buttons)
              if (time < until) requestAnimationFrame(watch)
              else resolve({ ...seen, fading })
            })
          },
        ),
      button,
    )
  }
  const picked = await fadesAfter('Draw random card')
  expect(picked.fading, `prompt: ${picked.prompt.join(', ')}; buttons: ${picked.buttons.join(', ')}`).toEqual({
    prompt: true,
    buttons: true,
  })
  expect(picked.prompt.at(-1)).toBe(-1)
  expect(picked.buttons.at(-1)).toBe(1)

  const cleared = await fadesAfter('Clear plan')
  expect(cleared.fading, `prompt: ${cleared.prompt.join(', ')}; buttons: ${cleared.buttons.join(', ')}`).toEqual({
    prompt: true,
    buttons: true,
  })
  expect(cleared.buttons.at(-1)).toBe(-1)
  expect(cleared.prompt.at(-1)).toBe(1)
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

async function narrowPlanOfThree(page: Page, width: number) {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/sample')
  for (let picked = 1; picked <= 3; picked++) {
    await page.getByRole('button', { name: 'Draw random card' }).click()
    await expect(page.locator('[data-card-id]')).toHaveCount(picked)
  }
  // Last used the plan, so it's in use once the window is narrow.
  await page.setViewportSize({ width, height: 900 })
  await expect.poll(() => zoomOf(page.getByRole('region', { name: 'Your plan' }))).toBe('1')
  await page.waitForTimeout(700)
}

/** @see docs/card-layout.md § "Narrow screens" - the plan in a grid */
test('on a narrow screen with room, the plan in use is a grid like the deck', async ({ page }) => {
  await narrowPlanOfThree(page, 860)
  const boxes = await planCardBoxes(page)
  // Side by side, like the deck when it's in use.
  expect(boxes[1].y).toBe(boxes[0].y)
  expect(boxes[1].x).toBeGreaterThan(boxes[0].x)
})

/** @see docs/card-layout.md § "Narrow screens" - the plan in a grid */
test('on a narrow screen without room, the plan in use is one column', async ({ page }) => {
  await narrowPlanOfThree(page, 420)
  const boxes = await planCardBoxes(page)
  expect(new Set(boxes.map((box) => box.x)).size).toBe(1)
  expect(boxes[1].y).toBeGreaterThan(boxes[0].y)
  expect(boxes[2].y).toBeGreaterThan(boxes[1].y)
})

/** @see docs/card-layout.md § "Reordering the plan" - by dragging it */
test('a card is dragged along a line of the plan when it is a grid', async ({ page }) => {
  await narrowPlanOfThree(page, 860)
  const [first, second] = await planCardBoxes(page)
  const card = page.locator(`[data-card-id="${first.id}"]`)
  const box = await card.boundingBox()
  const secondBox = await page.locator(`[data-card-id="${second.id}"]`).boundingBox()
  if (!box || !secondBox) throw new Error('Cards have no size')

  // Sideways, past the middle of the card beside it.
  const y = box.y + box.height / 2
  await card.hover()
  await page.mouse.move(box.x + box.width / 2, y)
  await page.mouse.down()
  await page.mouse.move(secondBox.x + secondBox.width * 0.8, y, { steps: 20 })
  await page.mouse.up()
  await expect
    .poll(async () => (await planCardBoxes(page)).map((each) => each.id).slice(0, 2))
    .toEqual([second.id, first.id])
})

/** @see docs/card-layout.md § "The plan column" - scrolling over it */
test('scrolling over the plan scrolls the page when it fits, and the plan first when it does not', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/sample')
  const column = page.locator('.plan-scroll')
  const box = await column.boundingBox()
  if (!box) throw new Error('No plan column')
  const scrollY = () => page.evaluate(() => window.scrollY)

  // Nothing picked, so the plan fits: the page scrolls.
  await page.mouse.move(box.x + box.width / 2, box.y + 100)
  await page.mouse.wheel(0, 300)
  await expect.poll(scrollY).toBeGreaterThan(200)

  // Taller than the window: the plan scrolls to its end first.
  await page.evaluate(() => window.scrollTo(0, 0))
  for (let picked = 1; picked <= 4; picked++) {
    await page.getByRole('button', { name: 'Draw random card' }).click()
    await expect(page.locator('[data-card-id]')).toHaveCount(picked)
  }
  await page.waitForTimeout(800)
  await column.evaluate((element) => {
    element.scrollTop = 0
    window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY)
  })
  const pageBefore = await scrollY()
  const stuck = await column.boundingBox()
  if (!stuck) throw new Error('No plan column')
  await page.mouse.move(stuck.x + stuck.width / 2, stuck.y + 300)
  await page.mouse.wheel(0, 200)
  await expect.poll(() => column.evaluate((element) => element.scrollTop)).toBeGreaterThan(100)
  expect(await scrollY()).toBe(pageBefore)

  // Once it's at its end, the next scroll moves the page.
  await column.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  await page.waitForTimeout(300)
  await page.mouse.wheel(0, 300)
  await expect.poll(scrollY).toBeGreaterThan(pageBefore + 100)
})

/** @see docs/card-layout.md § "The plan column" - the title, and fading out */
for (const opened of ['as picked', 'after a reload, with the picks kept']) {
  test(`the plan has its title above it, and fades out where it is scrolled out of sight, ${opened}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/sample')
    for (let picked = 1; picked <= 4; picked++) {
      await page.getByRole('button', { name: 'Draw random card' }).click()
      await expect(page.locator('[data-card-id]')).toHaveCount(picked)
    }
    // Kept picks lay the plan out afresh, with a new element that scrolls.
    if (opened !== 'as picked') {
      await page.reload()
      await expect(page.locator('[data-card-id]')).toHaveCount(4)
    }
    await page.waitForTimeout(800)
    const scroller = page.locator('.plan-scroll')
    const title = page.getByRole('heading', { name: 'The Plan' })
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
  })
}

/** @see docs/card-layout.md § "The grid of cards" */
test("a line of cards that isn't full is in the middle, and Draw random card sits a little apart", async ({ page }) => {
  await narrowPlanOfThree(page, 860)
  const columns = await page
    .locator('.plan-track')
    .first()
    .evaluate((element) => Number.parseInt(getComputedStyle(element).getPropertyValue('--columns'), 10))
  // One more card than fits on a line, so the last is alone on the next.
  for (let picked = 4; picked <= columns + 1; picked++) {
    await page.getByRole('button', { name: 'Draw random card' }).click()
    await expect(page.locator('[data-card-id]')).toHaveCount(picked)
  }
  await page.waitForTimeout(800)
  const boxes = await planCardBoxes(page)
  expect(columns).toBeGreaterThan(1)
  const last = boxes[columns]
  expect(last.y).toBeGreaterThan(boxes[0].y)
  const track = await page
    .locator('.plan-track')
    .first()
    .evaluate((element) => (element as HTMLElement).offsetWidth)
  const width = await page
    .locator('[data-card-id]')
    .first()
    .evaluate((element) => (element as HTMLElement).offsetWidth)
  expect(Math.abs(last.x + width / 2 - track / 2)).toBeLessThan(2)

  // More room above Draw random card than between the cards.
  const gap = await page.evaluate(() => {
    const cards = [...document.querySelectorAll<HTMLElement>('.plan-track [data-card-id]')]
    const lastCard = cards[cards.length - 1].getBoundingClientRect()
    const link = (document.querySelector('.random-pick') as HTMLElement).getBoundingClientRect()
    return link.top - lastCard.bottom
  })
  expect(gap).toBeGreaterThan(20)
})

/** @see docs/card-layout.md § "Narrow screens" - cards still slide */
test('with the plan shrunk, a second card picked makes room by sliding the first over', async ({ page }) => {
  await page.setViewportSize({ width: 860, height: 900 })
  await page.goto('/sample')
  const pick = () =>
    page.evaluate(() =>
      document.querySelector<HTMLElement>('[data-deck-card-id] button[aria-label^="Add to plan"]')?.click(),
    )
  await pick()
  await expect(page.locator('[data-card-id]')).toHaveCount(1)
  await page.waitForTimeout(900)
  expect(
    await page
      .locator('.plan-track')
      .first()
      .evaluate((element) => Number.parseInt(getComputedStyle(element).getPropertyValue('--columns'), 10)),
  ).toBeGreaterThan(1)

  // The first card, within its row, frame by frame as the second comes in.
  await page.evaluate(() => {
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
  await page.waitForTimeout(1300)
  const xs = await page.evaluate(() => (window as unknown as { xs: number[] }).xs)
  const distinct = new Set(xs.map((x) => Math.round(x)))
  // Some frames part way, however few a busy machine draws.
  expect(distinct.size, [...distinct].join(', ')).toBeGreaterThan(2)
  expect(xs[xs.length - 1]).toBeLessThan(xs[0])
  // Only ever to the left, without overshooting its place.
  expect(xs).toEqual([...xs].sort((a, b) => b - a))
})
