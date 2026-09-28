import {
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  test as base,
  type Page,
} from '@playwright/test'

export { expect } from '@playwright/test'

// Better Auth rate-limits sign-in per visitor IP, which Cloudflare passes in
// cf-connecting-ip. Locally every request would come from one address and
// trip the limit, so each test, and each extra browser it opens, claims its
// own address, as separate people would. Rate limiting stays on.
function visitorAddress() {
  const part = () => Math.floor(Math.random() * 250) + 1
  return `10.${part()}.${part()}.${part()}`
}

// Once a page has loaded, it only does anything once React has taken it over
// (HydratedMark marks <html>). A click before then is lost, and on a busy
// machine that can be seconds after the load, so goto and reload wait for it
// too (docs/testing.md § "Waiting for the page's script").
function waitForHydration(page: Page) {
  const { goto, reload } = page
  page.goto = async (...args) => {
    const response = await goto.apply(page, args)
    await hydrated(page)
    return response
  }
  page.reload = async (...args) => {
    const response = await reload.apply(page, args)
    await hydrated(page)
    return response
  }
}

function hydrated(page: Page) {
  // Pages without the app's script (a picture, say) have nothing to wait for.
  return page.waitForFunction(
    () => !document.querySelector('script[src*="/_next/"]') || document.documentElement.hasAttribute('data-hydrated'),
  )
}

function waitForHydrationIn(context: BrowserContext) {
  for (const page of context.pages()) waitForHydration(page)
  context.on('page', waitForHydration)
  return context
}

export const test = base.extend({
  extraHTTPHeaders: async ({ extraHTTPHeaders }, use) => {
    await use({ ...extraHTTPHeaders, 'cf-connecting-ip': visitorAddress() })
  },
  context: async ({ context, javaScriptEnabled }, use) => {
    await use(javaScriptEnabled === false ? context : waitForHydrationIn(context))
  },
})

// A second person, or the same person on another device.
export async function newVisitor(browser: Browser, options: BrowserContextOptions = {}) {
  const context = await browser.newContext({ ...options, extraHTTPHeaders: { 'cf-connecting-ip': visitorAddress() } })
  return options.javaScriptEnabled === false ? context : waitForHydrationIn(context)
}
