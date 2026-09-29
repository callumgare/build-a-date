import { expect, type Page } from '@playwright/test'
import { test } from './fixtures'
import { expectStill, pressOption } from './helpers'

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
    .poll(async () => {
      const state = await builderState(page)
      return {
        plan: state.plan,
        deckCount: state.deck.length,
        inBoth: state.deck.filter((id) => state.plan.includes(id)),
        notDrawn: state.notDrawn,
      }
    })
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
  await expect(page.locator('.builder')).not.toHaveAttribute('data-switching')
}

async function add(page: Page, id: string) {
  await switchTo(page, 'deck')
  const card = page.locator(`[data-deck-card-id="${id}"]`)
  await card.scrollIntoViewIfNeeded()
  await pressOption(card.getByRole('button', { name: /^Add to plan: / }))
}

async function discard(page: Page, id: string) {
  await switchTo(page, 'plan')
  const card = page.locator(`[data-card-id="${id}"]`)
  await card.scrollIntoViewIfNeeded()
  await pressOption(card.getByRole('button', { name: /^Discard: / }))
}

// The same run every time, so a failure can be followed step by step.
function seededRandom(seed: number) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 2 ** 32
    return state / 2 ** 32
  }
}

/** @see docs/card-layout.md § "Flying cards" - nothing left behind, and § "Narrow screens" */
test('a random run of picks, discards, resizes and switches keeps the plan and deck in step', async ({ page }) => {
  test.setTimeout(180_000)
  await page.setViewportSize(wide)
  await page.goto('/sample')
  const ids = await page
    .locator('[data-deck-card-id]')
    .evaluateAll((cards) => cards.map((card) => (card as HTMLElement).dataset.deckCardId ?? ''))
  const total = ids.length
  let planned: string[] = []
  const random = seededRandom(20260927)

  for (let index = 0; index < 25; index++) {
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
      if (step === 'resize') await page.setViewportSize(isNarrow(page) ? wide : narrow)
      else if (step === 'switch') {
        if (isNarrow(page)) await switchTo(page, (await activeColumn(page)) === 'plan' ? 'deck' : 'plan')
      } else if (step === 'draw random') {
        await switchTo(page, 'plan')
        const link = page.getByRole('button', { name: 'Draw random card' })
        await link.scrollIntoViewIfNeeded()
        await link.click()
        await expect.poll(async () => (await builderState(page)).plan.length).toBe(planned.length + 1)
        planned = (await builderState(page)).plan
      } else {
        const [action, id] = step.split(' ')
        if (action === 'add') {
          await add(page, id)
          planned.push(id)
        } else {
          await discard(page, id)
          planned = planned.filter((each) => each !== id)
        }
      }
      await expectSettled(page, planned, total)
    })
  }
})

// Presses a button from inside the page, so no frame of the flight is
// missed, then watches the stand-in that flies a card across until it's
// gone: how many frames it was seen for, whether its words spilt out of it,
// and where it and the card's place in its new column were on its last
// frame. The place is read on the same frame, as whatever is around it may
// move afterwards.
function watchFlight(page: Page, button: string, place: string) {
  type Box = { x: number; y: number; width: number }
  return page.evaluate(
    ([button, place]) =>
      new Promise<{ frames: number; last: Box | null; landing: Box | null; spills: number }>((resolve) => {
        let frames = 0
        let spills = 0
        let last: Box | null = null
        let landing: Box | null = null
        const box = (element: Element) => {
          const { x, y, width } = element.getBoundingClientRect()
          return { x, y, width }
        }
        document.querySelector<HTMLElement>(button)?.click()
        const until = performance.now() + 3000
        requestAnimationFrame(function watch(time) {
          const flyer = document.querySelector('body > [aria-hidden="true"][class*="flying"]')
          if (flyer) {
            frames++
            last = box(flyer)
            const target = document.querySelector(place)
            landing = target && box(target)
            // Frames where the card's words spill out of it.
            const bounds = flyer.getBoundingClientRect()
            const slack = bounds.width * 0.02
            const spilt = [...flyer.querySelectorAll('[class*="title"], [class*="description"]')].some((text) => {
              const words = text.getBoundingClientRect()
              return (
                words.left < bounds.left - slack ||
                words.right > bounds.right + slack ||
                words.top < bounds.top - slack ||
                words.bottom > bounds.bottom + slack
              )
            })
            if (spilt) spills++
          }
          // Until it has flown and gone, or long after it should have.
          if ((frames === 0 || flyer) && time < until) requestAnimationFrame(watch)
          else resolve({ frames, last, landing, spills })
        })
      }),
    [button, place],
  )
}

/** @see docs/card-layout.md § "Flying cards" */
for (const size of ['wide', 'narrow'] as const) {
  test(`on a ${size} screen a card flies into the plan when picked, and back into the deck when discarded`, async ({
    page,
  }) => {
    await page.setViewportSize(size === 'wide' ? wide : narrow)
    await page.goto('/sample')
    const [first, id] = await Promise.all(
      [0, 2].map((nth) => page.locator('[data-deck-card-id]').nth(nth).getAttribute('data-deck-card-id')),
    )
    if (!first || !id) throw new Error('No cards')
    // Something in the plan already, so neither flight starts or empties it.
    // On the sample deck on a narrow screen that changes the bar's height,
    // moving everything under it (docs/card-layout.md § "Save plan and Clear
    // plan").
    await add(page, first)
    await expectSettled(page, [first], 32)

    for (const [action, place] of [
      ['add', `[data-card-id="${id}"]`],
      ['discard', `[data-deck-card-id="${id}"]`],
    ] as const) {
      await switchTo(page, action === 'add' ? 'deck' : 'plan')
      const card = page.locator(action === 'add' ? `[data-deck-card-id="${id}"]` : `[data-card-id="${id}"]`)
      await card.scrollIntoViewIfNeeded()
      await card.hover()
      const button = action === 'add' ? 'button[aria-label^="Add to plan"]' : 'button[aria-label^="Discard"]'
      const from = action === 'add' ? `[data-deck-card-id="${id}"]` : `[data-card-id="${id}"]`
      const flight = await watchFlight(page, `${from} ${button}`, place)
      await expectSettled(page, action === 'add' ? [first, id] : [first], 32)

      // Seen flying, and last seen where the card now sits, even in a shrunk
      // column. Seen at all is enough to show it flew: how many frames a busy
      // machine draws is up to it.
      expect(flight.frames).toBeGreaterThan(0)
      expect(flight.spills).toBe(0)
      const { last, landing } = flight
      if (!last || !landing) throw new Error('No flight, or no card')
      expect(Math.abs(last.x - landing.x)).toBeLessThan(4)
      expect(Math.abs(last.y - landing.y)).toBeLessThan(4)
      expect(Math.abs(last.width - landing.width)).toBeLessThan(4)
    }
  })
}

/** @see docs/card-layout.md § "The plan column" - the slot */
for (const size of ['wide', 'narrow', 'narrow with room for columns'] as const) {
  test(`on a ${size} screen the first card picked flies onto the blank slot and covers it`, async ({ page }) => {
    await page.setViewportSize(size === 'wide' ? wide : size === 'narrow' ? narrow : { width: 860, height: 900 })
    await page.goto('/sample')
    const slot = page.locator('.plan-track .empty-slot')
    const card = page.locator('[data-deck-card-id]').first()
    const add = card.getByRole('button', { name: /^Add to plan: / })
    // Hovered first, which can scroll the page, then the slot measured once
    // it's still: just after the page's script takes over, the shrunk plan
    // makes room for a scrollbar, and the slot slides to its new size.
    await card.hover()
    await expect(add).toBeVisible()
    await expect
      .poll(() =>
        slot.evaluate(
          (element) =>
            new Promise<boolean>((resolve) => {
              const box = () => JSON.stringify(element.getBoundingClientRect())
              // The same on every frame for half a second.
              const first = box()
              const until = performance.now() + 500
              requestAnimationFrame(function watch(time) {
                if (box() !== first) resolve(false)
                else if (time > until) resolve(true)
                else requestAnimationFrame(watch)
              })
            }),
        ),
      )
      .toBe(true)
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
    const frames = await page.evaluate(
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
    expect(frames.flying).toBeGreaterThan(0)
    expect(frames.slotMoved).toBe(0)
    // It landed on the slot, which has gone now the card covers it, and the
    // card is the slot's size.
    if (!frames.flyer) throw new Error('No flight')
    await expect(slot).toHaveCount(0)
    const landed = await page.locator('[data-card-id]').boundingBox()
    if (!landed) throw new Error('No card')
    expect(Math.abs(frames.flyer.x - landed.x)).toBeLessThan(4)
    expect(Math.abs(frames.flyer.y - landed.y)).toBeLessThan(4)
    expect(Math.abs(frames.flyer.width - landed.width)).toBeLessThan(4)
    expect(Math.abs(landed.width - before.width)).toBeLessThan(4)
    await expectSettled(page, [(await page.locator('[data-card-id]').getAttribute('data-card-id')) ?? ''], 32)
  })
}

// Where one element is drawn within its grid, frame by frame, while the
// window is resized: from before the resize until it has stopped moving,
// however long a busy machine takes to get there.
async function watchWhileResizing(page: Page, selector: string, size: { width: number; height: number }) {
  type Seen = { places: { x: number; y: number }[]; stop: boolean }
  await page.evaluate((selector) => {
    const seen: Seen = { places: [], stop: false }
    ;(window as unknown as { seen: Seen }).seen = seen
    requestAnimationFrame(function watch() {
      const element = document.querySelector(selector)
      const grid = element?.parentElement?.getBoundingClientRect()
      const box = element?.getBoundingClientRect()
      // Within its grid, so the page moving doesn't count.
      if (box && grid) seen.places.push({ x: Math.round(box.x - grid.x), y: Math.round(box.y - grid.y) })
      if (!seen.stop) requestAnimationFrame(watch)
    })
  }, selector)
  await page.waitForFunction(() => (window as unknown as { seen: Seen }).seen.places.length > 3)
  const before = await page.evaluate(() => (window as unknown as { seen: Seen }).seen.places.length)
  await page.setViewportSize(size)
  // Settled: nothing in its grid moving, and the same place on the last few
  // frames, some time after the resize.
  await expect
    .poll(() =>
      page.evaluate(
        ([selector, before]) => {
          const { places } = (window as unknown as { seen: Seen }).seen
          const element = document.querySelector(selector)
          const moving = element?.parentElement?.getAnimations({ subtree: true }).length ?? 1
          const last = places.slice(-5).map((place) => `${place.x},${place.y}`)
          return places.length > before + 5 && moving === 0 && new Set(last).size === 1
        },
        [selector, before] as const,
      ),
    )
    .toBe(true)
  return page.evaluate(() => {
    const { seen } = window as unknown as { seen: Seen }
    seen.stop = true
    return seen.places
  })
}

/** @see docs/card-layout.md § "Shuffling to a new number of columns" */
test('the deck shuffles its cards into place when it loses a column', async ({ page }) => {
  // Tall enough that the card is on screen before and after.
  await page.setViewportSize({ width: 1280, height: 1300 })
  await page.goto('/sample')
  await page.mouse.move(2, 2)
  const fourth = await page.locator('[data-deck-card-id]').nth(3).getAttribute('data-deck-card-id')

  // From the end of the first line to the start of the second.
  const places = await watchWhileResizing(page, `[data-deck-card-id="${fourth}"]`, { width: 1000, height: 1300 })
  const distinct = new Set(places.map((place) => `${place.x},${place.y}`))
  // Somewhere in between too, not only where it started and ended: however
  // few frames a busy machine draws, some land part way.
  expect(distinct.size, [...distinct].join(' ')).toBeGreaterThan(2)
  expect(places[0].x).toBeGreaterThan(places.at(-1)?.x ?? 0)
})

/** @see docs/card-layout.md § "Shuffling to a new number of columns", and § "Narrow screens" - the plan in a grid */
test('the plan in use on a narrow screen shuffles its cards into place when it loses a column', async ({ page }) => {
  await page.setViewportSize(wide)
  await page.goto('/sample')
  for (let picked = 1; picked <= 3; picked++) {
    await page.getByRole('button', { name: 'Draw random card' }).click()
    await expect(page.locator('[data-card-id]')).toHaveCount(picked)
  }
  await page.setViewportSize({ width: 860, height: 900 })
  await expect.poll(() => activeColumn(page)).toBe('plan')
  await page.mouse.move(2, 2)
  // In a grid of more than one column, with the three cards on fewer than
  // three lines, before it loses a column.
  await expect
    .poll(() =>
      page
        .locator('.plan-track')
        .first()
        .locator(':scope > [data-card-id]')
        .evaluateAll((cards) => new Set(cards.map((card) => (card as HTMLElement).offsetTop)).size),
    )
    .toBeLessThan(3)
  await expectStill(page)
  const third = await page.locator('[data-card-id]').nth(2).getAttribute('data-card-id')

  // Down to one column.
  const places = await watchWhileResizing(page, `[data-card-id="${third}"]`, { width: 520, height: 900 })
  const distinct = new Set(places.map((place) => `${place.x},${place.y}`))
  // Somewhere in between too, not only where it started and ended: however
  // few frames a busy machine draws, some land part way.
  expect(distinct.size, [...distinct].join(' ')).toBeGreaterThan(2)
  expect(places.at(-1)?.y).toBeGreaterThan(places[0].y)
})

/** @see docs/card-layout.md § "Flying cards" - Clear plan */
for (const layout of ['wide', 'narrow, plan in use', 'narrow, deck in use'] as const) {
  test(`Clear plan flies every card back into the deck (${layout})`, async ({ page }) => {
    await page.setViewportSize(wide)
    await page.goto('/sample')
    await page.getByRole('button', { name: 'Add group' }).click()
    const planned: string[] = []
    for (const index of [0, 3, 6]) {
      const id = (await page.locator('[data-deck-card-id]').nth(index).getAttribute('data-deck-card-id')) ?? ''
      await add(page, id)
      planned.push(id)
    }
    // One of them in the group.
    await page
      .getByRole('button', { name: /^Move / })
      .first()
      .focus()
    for (let step = 0; step < 3; step++) await page.keyboard.press('ArrowDown')
    await expect(page.locator('.plan-column .plan-group [data-card-id]')).toHaveCount(1)
    await expectSettled(page, (await builderState(page)).plan, 32)
    expect([...(await builderState(page)).plan].sort()).toEqual([...planned].sort())
    if (layout !== 'wide') {
      await page.setViewportSize(narrow)
      await switchTo(page, layout === 'narrow, plan in use' ? 'plan' : 'deck')
    }

    // Most cards in the air at once, pressed from inside the page so no frame
    // of the flights is missed.
    const mostAtOnce = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          let most = 0
          ;[...document.querySelectorAll<HTMLElement>('button')]
            .find((each) => each.textContent === 'Clear plan')
            ?.click()
          const until = performance.now() + 600
          requestAnimationFrame(function watch(time) {
            most = Math.max(most, document.querySelectorAll('body > [aria-hidden="true"][class*="flying"]').length)
            if (time < until) requestAnimationFrame(watch)
            else resolve(most)
          })
        }),
    )
    expect(mostAtOnce).toBe(3)
    await expectSettled(page, [], 32)
  })
}

/** @see docs/card-layout.md § "Shuffling to a new number of columns" - while a column grows or shrinks */
test('switching columns on a narrow screen never sends cards flying in from above', async ({ page }) => {
  await page.setViewportSize(wide)
  await page.goto('/sample')
  for (let picked = 1; picked <= 3; picked++) {
    await page.getByRole('button', { name: 'Draw random card' }).click()
    await expect(page.locator('[data-card-id]')).toHaveCount(picked)
  }
  await page.setViewportSize({ width: 860, height: 900 })
  await switchTo(page, 'deck')
  await page.mouse.move(2, 2)
  // Part way down the deck.
  await page.evaluate(() => window.scrollTo(0, 1200))
  await expectStill(page)

  // Every card, frame by frame through a switch: the ones that came onto
  // the screen from above it, and each card's tops within its column.
  async function watchSwitch(to: 'plan' | 'deck') {
    await page.evaluate(() => {
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
    await page
      .getByRole('button', { name: to === 'plan' ? 'Show your plan' : 'Show the date ideas' })
      .evaluate((button) => (button as HTMLElement).click())
    await expectStill(page)
    return page.evaluate(() => (window as unknown as { report: { fromAbove: string[] } }).report.fromAbove)
  }

  for (const to of ['plan', 'deck'] as const) {
    expect(await watchSwitch(to), `to the ${to}: came in from above`).toEqual([])
  }
})

/** @see docs/card-layout.md § "Narrow screens" - the whole column shrinks */
for (const width of [420, 860]) {
  test(`a shrunk column has the same columns of cards as when it's in use, all through a switch, ${width}px wide`, async ({
    page,
  }) => {
    await page.setViewportSize(wide)
    await page.goto('/sample')
    for (let picked = 1; picked <= 3; picked++) {
      await page.getByRole('button', { name: 'Draw random card' }).click()
      await expect(page.locator('[data-card-id]')).toHaveCount(picked)
    }
    await page.setViewportSize({ width, height: 900 })
    await switchTo(page, 'deck')
    await expectStill(page)

    // Each grid's columns and layout width, every frame, through switches
    // both ways.
    await page.evaluate(() => {
      const grids = { deck: '.deck-section .card-grid', plan: '.plan-track' }
      const seen: Record<string, Set<string>> = { deck: new Set(), plan: new Set() }
      ;(window as unknown as { seen: typeof seen }).seen = seen
      // Until the test has seen both switches over, however long they take.
      requestAnimationFrame(function watch() {
        for (const [name, selector] of Object.entries(grids)) {
          const grid = document.querySelector(selector) as HTMLElement
          const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').length
          seen[name].add(`${columns} columns, ${grid.offsetWidth} wide`)
        }
        if (!(window as unknown as { stop?: boolean }).stop) requestAnimationFrame(watch)
      })
    })
    for (const name of ['Show your plan', 'Show the date ideas']) {
      await page.getByRole('button', { name }).evaluate((button) => (button as HTMLElement).click())
      await expectStill(page)
    }
    const seen = await page.evaluate(() => {
      ;(window as unknown as { stop: boolean }).stop = true
      return Object.fromEntries(
        Object.entries((window as unknown as { seen: Record<string, Set<string>> }).seen).map(([name, values]) => [
          name,
          [...values],
        ]),
      )
    })
    expect(seen.deck, 'the deck').toHaveLength(1)
    expect(seen.plan, 'the plan').toHaveLength(1)
  })
}
