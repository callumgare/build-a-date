import { defineConfig, devices } from '@playwright/test'

// The tests start their own server on port 3100, so they never pick up a dev
// server you have running, or its Resend key. It uses the "e2e" wrangler
// environment, so it reads .dev.vars.e2e instead of .dev.vars, and keeps its
// own local database in .wrangler/e2e.
//
// By default that server runs as the app will on Cloudflare: an OpenNext
// build served by workerd. E2E_TARGET=dev uses `next dev` instead, for a
// quicker loop. Either way it starts from an empty database, so nothing a
// past run left behind (its previews add up) is carried along.
const port = 3100
const freshDatabase = 'rm -rf .wrangler/e2e && npm run db:migrate:e2e'
const command =
  process.env.E2E_TARGET === 'dev'
    ? `${freshDatabase} && E2E=1 next dev --port ${port}`
    : `${freshDatabase} && opennextjs-cloudflare build && opennextjs-cloudflare preview --env e2e --port ${port} --local-upstream localhost:${port} --persist-to .wrangler/e2e`

export default defineConfig({
  testDir: 'e2e',
  // Each test makes its own accounts and decks, or uses the sample deck,
  // so any two can run at once.
  fullyParallel: true,
  // Some tests go from signing up to a saved plan and back, which on a
  // machine busy running the rest can take longer than the default 30s.
  timeout: 60_000,
  // And a check that's slow to come true on a busy machine (a page drawing
  // few frames, a plan's preview drawn before it's saved) is given longer
  // than the default 5s. A check that passes still returns straight away.
  expect: { timeout: 15_000 },
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
