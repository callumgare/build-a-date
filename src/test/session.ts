// A stand-in for Better Auth, so the real getSession and requireUser in
// src/lib/auth.ts run against whoever the test signs in. Load it with
// `vi.mock('@/lib/auth-config', () => import('@/test/session'))`, plus the
// Cloudflare and Next stand-ins that src/lib/auth.ts reaches for, and
// `vi.mock('server-only', () => ({}))`.

export type TestUser = { id: string; name: string; email: string }

let current: TestUser | null = null

export function signInAs(user: TestUser | null) {
  current = user
}

export const api = {
  getSession: vi.fn(async () => (current ? { user: current, session: { userId: current.id } } : null)),
  listPasskeys: vi.fn(async (): Promise<{ id: string; name?: string; createdAt: Date }[]> => []),
}

export function createAuth() {
  return { api }
}
