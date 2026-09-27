import { readFile } from 'node:fs/promises'
import type { createTestDb } from './db'

// A stand-in for the Cloudflare request context. Load it with
// `vi.mock('@opennextjs/cloudflare', () => import('@/test/cloudflare'))`,
// and `vi.mock('@/db', () => import('@/test/cloudflare'))` to hand code the
// test database from `useTestDb`.

// The Worker's static assets, served from public/.
const ASSETS = {
  async fetch(url: URL | string) {
    const file = new URL(`../../public${new URL(url).pathname}`, import.meta.url)
    try {
      return new Response(await readFile(file))
    } catch {
      return new Response('Not found', { status: 404 })
    }
  },
}

export const env = {
  BETTER_AUTH_URL: 'http://localhost:3000',
  BETTER_AUTH_SECRET: 'test-secret-that-is-at-least-32-chars',
  EMAIL_FROM: 'Dates <hi@example.com>',
  ASSETS,
} as {
  ASSETS: typeof ASSETS
  BETTER_AUTH_URL: string
  BETTER_AUTH_SECRET: string
  EMAIL_FROM: string
  RESEND_API_KEY?: string
  OPENROUTER_API_KEY?: string
  OPENROUTER_MODEL?: string
}

const localEnv = { ...env }

export function getCloudflareContext() {
  return { env }
}

// Resets the env to a local one between tests.
export function resetEnv(overrides: Partial<typeof env> = {}) {
  for (const key of Object.keys(env)) delete (env as Record<string, unknown>)[key]
  Object.assign(env, localEnv, overrides)
}

let db: ReturnType<typeof createTestDb> | undefined

export function useTestDb(testDb: ReturnType<typeof createTestDb>) {
  db = testDb
}

// Only complains when the database is used, since some code gets it without
// using it (like getAuth, when Better Auth is a stand-in too).
const noDb = new Proxy({} as ReturnType<typeof createTestDb>, {
  get() {
    throw new Error('Call useTestDb first')
  },
})

export function getDb() {
  return db ?? noDb
}
