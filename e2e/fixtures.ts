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
  // Checked on a timer rather than each frame, as a busy page may draw few.
  return page.waitForFunction(
    () => !document.querySelector('script[src*="/_next/"]') || document.documentElement.hasAttribute('data-hydrated'),
    undefined,
    { polling: 100 },
  )
}

// The galaxy background is drawn with WebGL, which the test browsers do in
// software (SwiftShader), keeping each page's main thread busy for a third of
// the time. Several browsers doing it at once starve each other, so frames,
// clicks and checks come late and tests time out. Only the background's own
// tests need it; everywhere else WebGL is turned off and the background is
// its plain colour, as for anyone without WebGL 2 (docs/background.md
// § "Fallback", docs/testing.md § "End-to-end tests").
function withoutWebGL(context: BrowserContext) {
  return context.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...rest: unknown[]) {
      if (kind === 'webgl' || kind === 'webgl2' || kind === 'experimental-webgl') return null
      return (getContext as (...args: unknown[]) => RenderingContext | null).call(this, kind, ...rest)
    } as typeof getContext
  })
}

// A page can also load by other ways than goto: a form sent before the page
// it was on had taken over, a redirect, a link followed natively. Until the
// new page's script has taken over, it's covered by an invisible layer, so a
// click or hover waits, as Playwright waits for anything covering what it's
// about to press, rather than being lost (docs/testing.md § "Waiting for the
// page's script"). It's outside <body>, where React doesn't mind it.
function shieldUntilHydrated(context: BrowserContext) {
  return context.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const root = document.documentElement
      if (root.hasAttribute('data-hydrated') || !document.querySelector('script[src*="/_next/"]')) return
      const shield = document.createElement('div')
      shield.setAttribute('data-e2e-hydrating', '')
      shield.style.cssText = 'position:fixed;inset:0;z-index:2147483647'
      root.appendChild(shield)
      const observer = new MutationObserver(() => {
        if (!root.hasAttribute('data-hydrated')) return
        shield.remove()
        observer.disconnect()
      })
      observer.observe(root, { attributes: true, attributeFilter: ['data-hydrated'] })
    })
  })
}

async function prepare(context: BrowserContext, { galaxy, javaScriptEnabled }: VisitorOptions) {
  if (!galaxy) await withoutWebGL(context)
  if (javaScriptEnabled !== false) {
    await shieldUntilHydrated(context)
    for (const page of context.pages()) waitForHydration(page)
    context.on('page', waitForHydration)
  }
  return context
}

type VisitorOptions = BrowserContextOptions & {
  /** Draw the galaxy background with WebGL, for tests of the background itself. */
  galaxy?: boolean
}

export const test = base.extend<{ galaxy: boolean }>({
  galaxy: [false, { option: true }],
  extraHTTPHeaders: async ({ extraHTTPHeaders }, use) => {
    await use({ ...extraHTTPHeaders, 'cf-connecting-ip': visitorAddress() })
  },
  context: async ({ context, javaScriptEnabled, galaxy }, use) => {
    await use(await prepare(context, { galaxy, javaScriptEnabled }))
  },
})

// A second person, or the same person on another device.
export async function newVisitor(browser: Browser, { galaxy = false, ...options }: VisitorOptions = {}) {
  const context = await browser.newContext({ ...options, extraHTTPHeaders: { 'cf-connecting-ip': visitorAddress() } })
  return prepare(context, { galaxy, javaScriptEnabled: options.javaScriptEnabled })
}
