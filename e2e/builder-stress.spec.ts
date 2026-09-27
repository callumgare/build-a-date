import { expect, type Page } from '@playwright/test'
import { newVisitor, test } from './fixtures'
import { createDeck, signUp } from './helpers'

const wide = { width: 1280, height: 800 }
const narrow = { width: 420, height: 860 }

// What the builder shows, once it has settled: the ids in the plan and in the
// deck, and any card that isn't drawn (hidden, see-through or not full size)
// or is in both.
async function builderState(page: Page) {
  return page.evaluate(() => {
    const drawn = (element: Element) => {
      const style = getComputedStyle(element)
      const box = element.getBoundingClientRect()
      return style.visibility === 'visible' && Number(style.opacity) === 1 && box.width > 0 && box.height > 0
    }
    const plan = [...document.querySelectorAll<HTMLElement>('[data-card-id]')]
    const deck = [...document.querySelectorAll<HTMLElement>('[data-deck-card-id]')]
    return {
      plan: plan.map((card) => card.dataset.cardId ?? ''),
      deck: deck.map((card) => card.dataset.deckCardId ?? ''),
      notDrawn: [...plan, ...deck]
        .filter((card) => !drawn(card))
        .map((card) => card.dataset.cardId ?? card.dataset.deckCardId ?? ''),
    }
  })
}

// Every idea in exactly one place, the plan in the order expected, and every
// card drawn.
async function expectSettled(page: Page, planned: string[], total: number) {
  await expect
    .poll(
      async () => {
        const state = await builderState(page)
        return {
          plan: state.plan,
          deckCount: state.deck.length,
          inBoth: state.deck.filter((id) => state.plan.includes(id)),
          notDrawn: state.notDrawn,
        }
      },
      { timeout: 5000 },
    )
    .toEqual({ plan: planned, deckCount: total - planned.length, inBoth: [], notDrawn: [] })
}

function isNarrow(page: Page) {
  return (page.viewportSize()?.width ?? 0) < 900
}

async function activeColumn(page: Page) {
  return page.locator('.builder').getAttribute('data-active')
}

async function switchTo(page: Page, column: 'plan' | 'deck') {
  if (!isNarrow(page) || (await activeColumn(page)) === column) return
  await page.getByRole('button', { name: column === 'plan' ? 'Show your plan' : 'Show the date ideas' }).click()
  await expect.poll(() => activeColumn(page)).toBe(column)
  await page.waitForTimeout(700)
}

async function add(page: Page, id: string) {
  await switchTo(page, 'deck')
  const card = page.locator(`[data-deck-card-id="${id}"]`)
  await card.scrollIntoViewIfNeeded()
  await card.hover()
  await card.getByRole('button', { name: /^Add to plan: / }).click()
}

async function discard(page: Page, id: string) {
  await switchTo(page, 'plan')
  const card = page.locator(`[data-card-id="${id}"]`)
  await card.scrollIntoViewIfNeeded()
  await card.hover()
  await card.getByRole('button', { name: /^Discard: / }).click()
}

/** @see docs/card-layout.md § "Flying cards" - nothing left behind, and § "Narrow screens" */
test('adding, discarding, resizing and switching columns keeps the plan and deck in step', async ({
  page,
  browser,
  request,
}) => {
  test.setTimeout(240_000)
  await signUp(page, request, 'Alex')
  const shareUrl = await createDeck(page, 'Ideas for Sam')

  const guestContext = await newVisitor(browser)
  const guest = await guestContext.newPage()
  await guest.setViewportSize(wide)
  await guest.goto(shareUrl)
  const ids = await guest
    .locator('[data-deck-card-id]')
    .evaluateAll((cards) => cards.map((card) => (card as HTMLElement).dataset.deckCardId ?? ''))
  const total = ids.length
  const planned: string[] = []
  await expectSettled(guest, planned, total)

  // A fixed run of steps, so a failure can be followed step by step.
  const steps: string[] = [
    'add 0',
    'add 1',
    'narrow',
    'add 2',
    'discard 0',
    'wide',
    'add 3',
    'discard 1',
    'narrow',
    'discard 2',
    'add 4',
    'add 5',
    'wide',
    'discard 4',
    'narrow',
    'add 6',
    'discard 3',
    'wide',
    'narrow',
    'add 0',
    'discard 5',
    'wide',
    'add 7',
    'discard 6',
    'narrow',
    'discard 0',
    'add 1',
    'wide',
    'discard 7',
  ]
  for (const [index, step] of steps.entries()) {
    const [action, which] = step.split(' ')
    const id = ids[Number(which) * 3]
    await test.step(`${index}: ${step}`, async () => {
      if (action === 'narrow') await guest.setViewportSize(narrow)
      else if (action === 'wide') await guest.setViewportSize(wide)
      else if (action === 'add') {
        await add(guest, id)
        planned.push(id)
      } else {
        await discard(guest, id)
        planned.splice(planned.indexOf(id), 1)
      }
      await expectSettled(guest, planned, total)
    })
  }

  await guestContext.close()
})

// The same run every time, so a failure can be followed step by step.
function seededRandom(seed: number) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 2 ** 32
    return state / 2 ** 32
  }
}

/** @see docs/card-layout.md § "Flying cards" - nothing left behind, and § "Narrow screens" */
test('a long random run of picks, discards, resizes and switches keeps the plan and deck in step', async ({
  page,
  browser,
  request,
}) => {
  test.setTimeout(300_000)
  await signUp(page, request, 'Alex')
  const shareUrl = await createDeck(page, 'Ideas for Sam')

  const guestContext = await newVisitor(browser)
  const guest = await guestContext.newPage()
  await guest.setViewportSize(wide)
  await guest.goto(shareUrl)
  const ids = await guest
    .locator('[data-deck-card-id]')
    .evaluateAll((cards) => cards.map((card) => (card as HTMLElement).dataset.deckCardId ?? ''))
  const total = ids.length
  let planned: string[] = []
  const random = seededRandom(20260927)

  for (let index = 0; index < 40; index++) {
    const roll = random()
    const inPlan = planned.length > 0
    const step =
      roll < 0.12
        ? 'resize'
        : roll < 0.22
          ? 'switch'
          : roll < 0.32
            ? 'draw random'
            : inPlan && roll < 0.62
              ? `discard ${planned[Math.floor(random() * planned.length)]}`
              : `add ${ids.filter((id) => !planned.includes(id))[Math.floor(random() * 10)]}`
    await test.step(`${index}: ${step}`, async () => {
      if (step === 'resize') await guest.setViewportSize(isNarrow(guest) ? wide : narrow)
      else if (step === 'switch') {
        if (isNarrow(guest)) await switchTo(guest, (await activeColumn(guest)) === 'plan' ? 'deck' : 'plan')
      } else if (step === 'draw random') {
        await switchTo(guest, 'plan')
        const link = guest.getByRole('button', { name: 'Draw random card' })
        await link.scrollIntoViewIfNeeded()
        await link.click()
        await expect.poll(async () => (await builderState(guest)).plan.length).toBe(planned.length + 1)
        planned = (await builderState(guest)).plan
      } else {
        const [action, id] = step.split(' ')
        if (action === 'add') {
          await add(guest, id)
          planned.push(id)
        } else {
          await discard(guest, id)
          planned = planned.filter((each) => each !== id)
        }
      }
      await expectSettled(guest, planned, total)
    })
  }

  await guestContext.close()
})

// Watches the stand-in that flies a card across, from just after a click
// until it's gone, and where it was last seen.
function watchFlight(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{ frames: number; last: { x: number; y: number; width: number } | null; spills: number }>(
        (resolve) => {
          let frames = 0
          let spills = 0
          let last: { x: number; y: number; width: number } | null = null
          const until = performance.now() + 1500
          requestAnimationFrame(function watch(time) {
            const flyer = document.querySelector('body > [aria-hidden="true"][class*="flying"]')
            if (flyer) {
              frames++
              const box = flyer.getBoundingClientRect()
              last = { x: box.x, y: box.y, width: box.width }
              // Frames where the card's words spill out of it.
              const slack = box.width * 0.02
              const spilt = [...flyer.querySelectorAll('[class*="title"], [class*="description"]')].some((text) => {
                const words = text.getBoundingClientRect()
                return (
                  words.left < box.left - slack ||
                  words.right > box.right + slack ||
                  words.top < box.top - slack ||
                  words.bottom > box.bottom + slack
                )
              })
              if (spilt) spills++
            }
            if (time < until) requestAnimationFrame(watch)
            else resolve({ frames, last, spills })
          })
        },
      ),
  )
}

/** @see docs/card-layout.md § "Flying cards" */
for (const size of ['wide', 'narrow'] as const) {
  test(`on a ${size} screen a card flies into the plan when picked, and back into the deck when discarded`, async ({
    page,
    browser,
    request,
  }) => {
    await signUp(page, request, 'Alex')
    const shareUrl = await createDeck(page, 'Ideas for Sam')

    const guestContext = await newVisitor(browser)
    const guest = await guestContext.newPage()
    await guest.setViewportSize(size === 'wide' ? wide : narrow)
    await guest.goto(shareUrl)
    const id = await guest.locator('[data-deck-card-id]').nth(2).getAttribute('data-deck-card-id')
    if (!id) throw new Error('No cards')

    for (const [action, place] of [
      ['add', `[data-card-id="${id}"]`],
      ['discard', `[data-deck-card-id="${id}"]`],
    ] as const) {
      await switchTo(guest, action === 'add' ? 'deck' : 'plan')
      const card = guest.locator(action === 'add' ? `[data-deck-card-id="${id}"]` : `[data-card-id="${id}"]`)
      await card.scrollIntoViewIfNeeded()
      await card.hover()
      await card.getByRole('button', { name: action === 'add' ? /^Add to plan: / : /^Discard: / }).click()
      const flight = await watchFlight(guest)
      await expectSettled(guest, action === 'add' ? [id] : [], 32)

      // Seen for a while, and last seen where the card now sits, even in a
      // shrunk column.
      expect(flight.frames).toBeGreaterThan(10)
      expect(flight.spills).toBe(0)
      const landed = await guest.locator(place).boundingBox()
      if (!flight.last || !landed) throw new Error('No flight, or no card')
      expect(Math.abs(flight.last.x - landed.x)).toBeLessThan(4)
      expect(Math.abs(flight.last.y - landed.y)).toBeLessThan(4)
      expect(Math.abs(flight.last.width - landed.width)).toBeLessThan(4)
    }

    await guestContext.close()
  })
}

/** @see docs/card-layout.md § "The plan column" - the slot */
for (const size of ['wide', 'narrow', 'narrow with room for columns'] as const) {
  test(`on a ${size} screen the first card picked flies onto the blank slot and covers it`, async ({
    page,
    browser,
    request,
  }) => {
    await signUp(page, request, 'Alex')
    const shareUrl = await createDeck(page, 'Ideas for Sam')

    const guestContext = await newVisitor(browser)
    const guest = await guestContext.newPage()
    await guest.setViewportSize(size === 'wide' ? wide : size === 'narrow' ? narrow : { width: 860, height: 900 })
    await guest.goto(shareUrl)
    const slot = guest.locator('.plan-track .empty-slot')
    const card = guest.locator('[data-deck-card-id]').first()
    const add = card.getByRole('button', { name: /^Add to plan: / })
    // Hovered first, which can scroll the page, then the slot measured.
    await card.hover()
    await expect(add).toBeVisible()
    const before = await slot.boundingBox()
    // Within its row too, for comparing with while the page may scroll.
    const inRow = await slot.evaluate((element) => {
      const box = element.getBoundingClientRect()
      const row = (element.parentElement as HTMLElement).getBoundingClientRect()
      return { x: box.x - row.x, y: box.y - row.y, width: box.width, height: box.height }
    })
    if (!before) throw new Error('No slot')
    // On every frame of the flight the slot is still there, where it was
    // and the size it was before the click.
    const frames = await guest.evaluate(
      (first) =>
        new Promise<{ flying: number; slotMoved: number; flyer: { x: number; y: number; width: number } | null }>(
          (resolve) => {
            let flying = 0
            let slotMoved = 0
            let flyer: { x: number; y: number; width: number } | null = null
            // Picked from here, so no frame of the flight is missed.
            document.querySelector<HTMLElement>('[data-deck-card-id] button[aria-label^="Add to plan"]')?.click()
            const until = performance.now() + 1500
            requestAnimationFrame(function watch(time) {
              const stand = document.querySelector('body > [aria-hidden="true"][class*="flying"]')
              if (stand) {
                flying++
                const box = stand.getBoundingClientRect()
                flyer = { x: box.x, y: box.y, width: box.width }
                const slotNow = document.querySelector('.plan-track .empty-slot')
                const slotBox = slotNow?.getBoundingClientRect()
                const row = slotNow?.parentElement?.getBoundingClientRect()
                // Within its row, as the page can scroll when a card leaves
                // the deck above.
                const now = slotBox &&
                  row && {
                    x: slotBox.x - row.x,
                    y: slotBox.y - row.y,
                    width: slotBox.width,
                    height: slotBox.height,
                  }
                if (
                  !now ||
                  Math.abs(now.x - first.x) > 1 ||
                  Math.abs(now.y - first.y) > 1 ||
                  Math.abs(now.width - first.width) > 1 ||
                  Math.abs(now.height - first.height) > 1
                )
                  slotMoved++
              }
              if (time < until) requestAnimationFrame(watch)
              else resolve({ flying, slotMoved, flyer })
            })
          },
        ),
      inRow,
    )
    expect(frames.flying).toBeGreaterThan(5)
    expect(frames.slotMoved).toBe(0)
    // It landed on the slot, which has gone now the card covers it, and the
    // card is the slot's size.
    if (!frames.flyer) throw new Error('No flight')
    await expect(slot).toHaveCount(0)
    const landed = await guest.locator('[data-card-id]').boundingBox()
    if (!landed) throw new Error('No card')
    expect(Math.abs(frames.flyer.x - landed.x)).toBeLessThan(4)
    expect(Math.abs(frames.flyer.y - landed.y)).toBeLessThan(4)
    expect(Math.abs(frames.flyer.width - landed.width)).toBeLessThan(4)
    expect(Math.abs(landed.width - before.width)).toBeLessThan(4)
    await expectSettled(guest, [(await guest.locator('[data-card-id]').getAttribute('data-card-id')) ?? ''], 32)

    await guestContext.close()
  })
}

// Where one element is drawn within its grid, frame by frame, while the
// window is resized. The recording is running before the resize starts.
async function watchWhileResizing(page: Page, selector: string, size: { width: number; height: number }) {
  await page.evaluate((selector) => {
    const seen: { x: number; y: number }[] = []
    ;(window as unknown as { seen: typeof seen }).seen = seen
    const until = performance.now() + 5000
    requestAnimationFrame(function watch(time) {
      const element = document.querySelector(selector)
      const grid = element?.parentElement?.getBoundingClientRect()
      const box = element?.getBoundingClientRect()
      // Within its grid, so the page moving doesn't count.
      if (box && grid) seen.push({ x: Math.round(box.x - grid.x), y: Math.round(box.y - grid.y) })
      if (time < until) requestAnimationFrame(watch)
    })
  }, selector)
  await page.waitForFunction(() => (window as unknown as { seen: unknown[] }).seen.length > 3)
  await page.setViewportSize(size)
  await page.waitForTimeout(1500)
  return page.evaluate(() => (window as unknown as { seen: { x: number; y: number }[] }).seen)
}

/** @see docs/card-layout.md § "Shuffling to a new number of columns" */
test('the deck shuffles its cards into place when it loses a column', async ({ page, browser, request }) => {
  await signUp(page, request, 'Alex')
  const shareUrl = await createDeck(page, 'Ideas for Sam')
  const guestContext = await newVisitor(browser)
  const guest = await guestContext.newPage()
  // Tall enough that the card is on screen before and after.
  await guest.setViewportSize({ width: 1280, height: 1300 })
  await guest.goto(shareUrl)
  await guest.mouse.move(2, 2)
  const fourth = await guest.locator('[data-deck-card-id]').nth(3).getAttribute('data-deck-card-id')

  // From the end of the first line to the start of the second.
  const places = await watchWhileResizing(guest, `[data-deck-card-id="${fourth}"]`, { width: 1000, height: 1300 })
  const distinct = new Set(places.map((place) => `${place.x},${place.y}`))
  expect(distinct.size, [...distinct].join(' ')).toBeGreaterThan(6)
  expect(places[0].x).toBeGreaterThan(places.at(-1)?.x ?? 0)

  await guestContext.close()
})

/** @see docs/card-layout.md § "Shuffling to a new number of columns", and § "Narrow screens" - the plan in a grid */
test('the plan in use on a narrow screen shuffles its cards into place when it loses a column', async ({
  page,
  browser,
  request,
}) => {
  await signUp(page, request, 'Alex')
  const shareUrl = await createDeck(page, 'Ideas for Sam')
  const guestContext = await newVisitor(browser)
  const guest = await guestContext.newPage()
  await guest.setViewportSize(wide)
  await guest.goto(shareUrl)
  for (let picked = 1; picked <= 3; picked++) {
    await guest.getByRole('button', { name: 'Draw random card' }).click()
    await expect(guest.locator('[data-card-id]')).toHaveCount(picked)
  }
  await guest.setViewportSize({ width: 860, height: 900 })
  await expect.poll(() => activeColumn(guest)).toBe('plan')
  await guest.mouse.move(2, 2)
  await guest.waitForTimeout(800)
  const third = await guest.locator('[data-card-id]').nth(2).getAttribute('data-card-id')

  // Down to one column.
  const places = await watchWhileResizing(guest, `[data-card-id="${third}"]`, { width: 520, height: 900 })
  const distinct = new Set(places.map((place) => `${place.x},${place.y}`))
  expect(distinct.size, [...distinct].join(' ')).toBeGreaterThan(6)
  expect(places.at(-1)?.y).toBeGreaterThan(places[0].y)

  await guestContext.close()
})

/** @see docs/card-layout.md § "Flying cards" - Clear plan */
for (const layout of ['wide', 'narrow, plan in use', 'narrow, deck in use'] as const) {
  test(`Clear plan flies every card back into the deck (${layout})`, async ({ page, browser, request }) => {
    await signUp(page, request, 'Alex')
    const shareUrl = await createDeck(page, 'Ideas for Sam')
    const guestContext = await newVisitor(browser)
    const guest = await guestContext.newPage()
    await guest.setViewportSize(wide)
    await guest.goto(shareUrl)
    await guest.getByRole('button', { name: 'Add group' }).click()
    const planned: string[] = []
    for (const index of [0, 3, 6]) {
      const id = (await guest.locator('[data-deck-card-id]').nth(index).getAttribute('data-deck-card-id')) ?? ''
      await add(guest, id)
      planned.push(id)
    }
    // One of them in the group.
    await guest
      .getByRole('button', { name: /^Move / })
      .first()
      .focus()
    for (let step = 0; step < 3; step++) await guest.keyboard.press('ArrowDown')
    await expect(guest.locator('.plan-column .plan-group [data-card-id]')).toHaveCount(1)
    await expectSettled(guest, (await builderState(guest)).plan, 32)
    expect([...(await builderState(guest)).plan].sort()).toEqual([...planned].sort())
    if (layout !== 'wide') {
      await guest.setViewportSize(narrow)
      await switchTo(guest, layout === 'narrow, plan in use' ? 'plan' : 'deck')
    }

    await guest.getByRole('button', { name: 'Clear plan' }).click()
    // Most cards in the air at once.
    const mostAtOnce = await guest.evaluate(
      () =>
        new Promise<number>((resolve) => {
          let most = 0
          const until = performance.now() + 600
          requestAnimationFrame(function watch(time) {
            most = Math.max(most, document.querySelectorAll('body > [aria-hidden="true"][class*="flying"]').length)
            if (time < until) requestAnimationFrame(watch)
            else resolve(most)
          })
        }),
    )
    expect(mostAtOnce).toBe(3)
    await expectSettled(guest, [], 32)

    await guestContext.close()
  })
}

/** @see docs/card-layout.md § "The plan column" - stays in the window */
test('picking and discarding a second card never gives the plan a scrollbar it does not need', async ({
  page,
  browser,
  request,
}) => {
  await signUp(page, request, 'Alex')
  const shareUrl = await createDeck(page, 'Ideas for Sam')
  const guestContext = await newVisitor(browser)
  const guest = await guestContext.newPage()
  await guest.setViewportSize({ width: 1280, height: 1400 })
  await guest.goto(shareUrl)
  await guest.getByRole('button', { name: 'Draw random card' }).click()
  await expect(guest.locator('[data-card-id]')).toHaveCount(1)
  await guest.waitForTimeout(800)

  // Frames where the plan's column overflows, or narrows.
  const watch = () =>
    guest.evaluate(
      () =>
        new Promise<number>((resolve) => {
          const column = document.querySelector('.plan-scroll') as HTMLElement
          const width = column.clientWidth
          let bad = 0
          const until = performance.now() + 900
          requestAnimationFrame(function check(time) {
            if (column.scrollHeight > column.clientHeight || column.clientWidth !== width) bad++
            if (time < until) requestAnimationFrame(check)
            else resolve(bad)
          })
        }),
    )
  const picking = watch()
  await guest.getByRole('button', { name: 'Draw random card' }).click()
  expect(await picking).toBe(0)
  await guest.waitForTimeout(500)
  const second = guest.locator('[data-card-id]').nth(1)
  await second.hover()
  const discarding = watch()
  await second.getByRole('button', { name: /^Discard: / }).click()
  expect(await discarding).toBe(0)

  await guestContext.close()
})

/** @see docs/card-layout.md § "Shuffling to a new number of columns" - while a column grows or shrinks */
test('switching columns on a narrow screen never sends cards flying in from above', async ({
  page,
  browser,
  request,
}) => {
  await signUp(page, request, 'Alex')
  const shareUrl = await createDeck(page, 'Ideas for Sam')
  const guestContext = await newVisitor(browser)
  const guest = await guestContext.newPage()
  await guest.setViewportSize(wide)
  await guest.goto(shareUrl)
  for (let picked = 1; picked <= 3; picked++) {
    await guest.getByRole('button', { name: 'Draw random card' }).click()
    await expect(guest.locator('[data-card-id]')).toHaveCount(picked)
  }
  await guest.setViewportSize({ width: 860, height: 900 })
  await switchTo(guest, 'deck')
  await guest.mouse.move(2, 2)
  // Part way down the deck.
  await guest.evaluate(() => window.scrollTo(0, 1200))
  await guest.waitForTimeout(800)

  // Every card, frame by frame through a switch: the ones that came onto
  // the screen from above it, and each card's tops within its column.
  async function watchSwitch(to: 'plan' | 'deck') {
    await guest.evaluate(() => {
      const report = { fromAbove: [] as string[], tops: new Map<Element, number[]>() }
      ;(window as unknown as { report: typeof report }).report = report
      const cards = [...document.querySelectorAll<HTMLElement>('[data-deck-card-id], [data-card-id]')]
      // Where on the page each card was, while it was above the window.
      const wasAbove = new Map<Element, number>()
      const until = performance.now() + 2500
      requestAnimationFrame(function watch(time) {
        for (const card of cards) {
          const box = card.getBoundingClientRect()
          const onPage = box.top + window.scrollY
          if (box.bottom < 0) wasAbove.set(card, onPage)
          else if (box.top < window.innerHeight && wasAbove.has(card)) {
            // Came down the page onto the screen, seen as it came: not the
            // page scrolling up to it as the deck gets shorter, and not one
            // fading in where it lands.
            const cameDown = onPage - (wasAbove.get(card) ?? onPage) > 100
            if (cameDown && Number(getComputedStyle(card).opacity) > 0.5)
              report.fromAbove.push(card.textContent?.slice(0, 20) ?? '')
            wasAbove.delete(card)
          }
        }
        if (time < until) requestAnimationFrame(watch)
      })
    })
    await guest
      .getByRole('button', { name: to === 'plan' ? 'Show your plan' : 'Show the date ideas' })
      .evaluate((button) => (button as HTMLElement).click())
    await guest.waitForTimeout(2600)
    return guest.evaluate(() => (window as unknown as { report: { fromAbove: string[] } }).report.fromAbove)
  }

  for (const to of ['plan', 'deck'] as const) {
    expect(await watchSwitch(to), `to the ${to}: came in from above`).toEqual([])
  }

  await guestContext.close()
})

/** @see docs/card-layout.md § "Narrow screens" - the whole column shrinks */
for (const width of [420, 860]) {
  test(`a shrunk column has the same columns of cards as when it's in use, all through a switch, ${width}px wide`, async ({
    page,
    browser,
    request,
  }) => {
    await signUp(page, request, 'Alex')
    const shareUrl = await createDeck(page, 'Ideas for Sam')
    const guestContext = await newVisitor(browser)
    const guest = await guestContext.newPage()
    await guest.setViewportSize(wide)
    await guest.goto(shareUrl)
    for (let picked = 1; picked <= 3; picked++) {
      await guest.getByRole('button', { name: 'Draw random card' }).click()
      await expect(guest.locator('[data-card-id]')).toHaveCount(picked)
    }
    await guest.setViewportSize({ width, height: 900 })
    await switchTo(guest, 'deck')
    await guest.waitForTimeout(800)

    // Each grid's columns and layout width, every frame, through switches
    // both ways.
    await guest.evaluate(() => {
      const grids = { deck: '.deck-section .card-grid', plan: '.plan-track' }
      const seen: Record<string, Set<string>> = { deck: new Set(), plan: new Set() }
      ;(window as unknown as { seen: typeof seen }).seen = seen
      const until = performance.now() + 4000
      requestAnimationFrame(function watch(time) {
        for (const [name, selector] of Object.entries(grids)) {
          const grid = document.querySelector(selector) as HTMLElement
          const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').length
          seen[name].add(`${columns} columns, ${grid.offsetWidth} wide`)
        }
        if (time < until) requestAnimationFrame(watch)
      })
    })
    await guest.getByRole('button', { name: 'Show your plan' }).evaluate((button) => (button as HTMLElement).click())
    await guest.waitForTimeout(1200)
    await guest
      .getByRole('button', { name: 'Show the date ideas' })
      .evaluate((button) => (button as HTMLElement).click())
    await guest.waitForTimeout(1200)
    const seen = await guest.evaluate(() =>
      Object.fromEntries(
        Object.entries((window as unknown as { seen: Record<string, Set<string>> }).seen).map(([name, values]) => [
          name,
          [...values],
        ]),
      ),
    )
    expect(seen.deck, 'the deck').toHaveLength(1)
    expect(seen.plan, 'the plan').toHaveLength(1)

    await guestContext.close()
  })
}
