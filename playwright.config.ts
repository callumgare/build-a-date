import { defineConfig, devices } from '@playwright/test'

// The tests start their own server on port 3100, so they never pick up a dev
// server you have running, or its Resend key. It uses the "e2e" wrangler
// environment, so it reads .dev.vars.e2e instead of .dev.vars, and keeps its
// own local database in .wrangler/e2e.
//
// By default that server runs as the app will on Cloudflare: an OpenNext
// build served by workerd. E2E_TARGET=dev uses `next dev` instead, for a
// quicker loop.
const port = 3100
const command =
  process.env.E2E_TARGET === 'dev'
    ? `npm run db:migrate:e2e && E2E=1 next dev --port ${port}`
    : `npm run db:migrate:e2e && opennextjs-cloudflare build && opennextjs-cloudflare preview --env e2e --port ${port} --local-upstream localhost:${port} --persist-to .wrangler/e2e`

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
  },
  // Passkeys are tested with Chrome's virtual authenticator, which only
  // Chromium exposes.
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    timeout: 300_000,
  },
})
