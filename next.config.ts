import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare'
import type { NextConfig } from 'next'

// Set by the e2e tests (see playwright.config.ts), which run their own dev
// server alongside yours, with their own settings and database.
const e2e = process.env.E2E === '1'

const nextConfig: NextConfig = {
  agentRules: false,
  // A lockfile further up the disk otherwise makes Turbopack guess the wrong root.
  turbopack: { root: import.meta.dirname },
  // Next allows one dev server per build folder.
  ...(e2e ? { distDir: '.next-e2e' } : {}),
}

export default nextConfig

// Gives `next dev` the bindings from wrangler.jsonc (local D1, vars,
// .dev.vars secrets) through getCloudflareContext().
initOpenNextCloudflareForDev(e2e ? { environment: 'e2e', persist: { path: '.wrangler/e2e/v3' } } : undefined)
