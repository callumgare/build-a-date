import { type Browser, test as base } from '@playwright/test'

export { expect } from '@playwright/test'

// Better Auth rate-limits sign-in per visitor IP, which Cloudflare passes in
// cf-connecting-ip. Locally every request would come from one address and
// trip the limit, so each test, and each extra browser it opens, claims its
// own address, as separate people would. Rate limiting stays on.
function visitorAddress() {
  const part = () => Math.floor(Math.random() * 250) + 1
  return `10.${part()}.${part()}.${part()}`
}

export const test = base.extend({
  extraHTTPHeaders: async ({ extraHTTPHeaders }, use) => {
    await use({ ...extraHTTPHeaders, 'cf-connecting-ip': visitorAddress() })
  },
})

// A second person, or the same person on another device.
export function newVisitor(browser: Browser) {
  return browser.newContext({ extraHTTPHeaders: { 'cf-connecting-ip': visitorAddress() } })
}
