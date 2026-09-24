# Testing

There are two suites. `npm test` runs Vitest over `src/**/*.test.{ts,tsx}`. `npm run test:e2e` runs Playwright over `e2e/`, against a server it starts itself (see `playwright.config.ts`). `npm run test:coverage` runs the Vitest suite and writes a coverage report to `coverage/`.

## Where each kind of test goes

| What's under test | Where the test lives | What's real |
| --- | --- | --- |
| Queries in `src/lib/decks.ts`, validation, email, ordering | Beside the file, e.g. `src/lib/decks.test.ts` | Everything, including the database: `createTestDb()` in `src/test/db.ts` builds an in-memory SQLite database from the same migrations D1 gets. |
| Server actions (`src/lib/actions/`), route handlers, server pages (`src/app/**/page.tsx`) | Beside the file, e.g. `src/app/(app)/decks/[deckId]/page.test.tsx` | The code under test, the queries, the test database, and `getSession`/`requireUser` from `src/lib/auth.ts`. Next's request-only functions, the Cloudflare context and Better Auth are stand-ins (see below). |
| Client components (`src/components/`) | Beside the component, with a `/** @vitest-environment jsdom */` docblock | The component and its children. Server actions it calls are mocked with `vi.mock('@/lib/actions/…')`. |
| Whole flows in a browser: passkeys, email links, forms without JavaScript, layout | `e2e/` | Everything. It uses an OpenNext build on workerd, or `next dev` with `E2E_TARGET=dev`. Emails are read from the dev outbox (`/api/dev/outbox`). `e2e/helpers.ts` has `signUp`, `createDeck`, `latestSignInLink` and `outboxCount` for the usual setup. |

A page that only returns one component (like `/d/[shareId]` returning `DeckBuilder`) is tested by checking the props it hands that component. That covers who gets an edit link and who sees the access list, without rendering the whole component. A page with its own markup is rendered in jsdom, with any client components it contains stubbed where they'd get in the way.

## Stand-ins for server-only code

Server code reaches for things that only exist inside a request on Cloudflare. `src/test/` has stand-ins for each of them. A test file loads the ones it needs with `vi.mock(…, () => import('@/test/…'))`, because a `vi.mock` call only applies to the file it's in:

```ts
vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => import('@/test/next'))
vi.mock('next/headers', () => import('@/test/next'))
vi.mock('next/cache', () => import('@/test/next'))
vi.mock('@opennextjs/cloudflare', () => import('@/test/cloudflare'))
vi.mock('@/db', () => import('@/test/cloudflare'))
vi.mock('@/lib/auth-config', () => import('@/test/session'))
```

- **`src/test/next.ts`** stands in for `next/navigation`, `next/headers`, `next/cache` and `next/server`. Like Next's own, `redirect()` and `notFound()` throw, so nothing after them runs. They throw a `RedirectError` whose message is `Redirected to <path>`, and a `NotFoundPage`, so a test can write `await expect(page()).rejects.toThrow('Redirected to /decks')`.
- **`src/test/cloudflare.ts`** stands in for `getCloudflareContext()` and `getDb()`. Its `env` is a local one (`http://localhost:3000`, no Resend key, so emails go to the outbox). `resetEnv({ … })` changes it for one test. For example, a production URL with no key makes `sendEmail` throw. Call `useTestDb(db)` in `beforeEach` to hand code the test database.
- **`src/test/session.ts`** stands in for `createAuth`, so the real `getSession` and `requireUser` run against whoever `signInAs(user)` signed in, or nobody after `signInAs(null)`. Its `api.listPasskeys` is a `vi.fn` to set per test.

Better Auth itself is only real in `src/lib/auth-config.test.ts` and the e2e tests. The action tests for `sendSignInLink` and `signOut` mock `getAuth` directly, to check what's passed to Better Auth and how its errors are handled.

## Gotchas

- **`next build` type-checks test files too**, so a type error in a test breaks the e2e build (and a deploy). Run `npm run typecheck` before `npm run test:e2e`.
- **`userEvent` hangs under `vi.useFakeTimers()`**, even with `advanceTimers` set. For debounced behaviour (like notes saving 0.7s after typing stops), use `fireEvent` inside `act` with fake timers, or real timers with `waitFor`.
- **A hook that returns a function gets that function called as cleanup.** Vitest treats a function returned from `beforeEach` as a teardown hook. So `beforeEach(() => mock.mockResolvedValue(x))` without braces returns the mock, which then gets called after the test. Use braces.
- **Motion's exit animations never finish in jsdom**, so an element leaving through `AnimatePresence` stays in the DOM. Assert on the state that drives it, or check the element going away in an e2e test.

## Timestamps in tests

Rows made one after another in a test often get the same `created_at` or `updated_at`, down to the millisecond. A test of ordering sets the timestamps it depends on explicitly, e.g. `db.update(plan).set({ createdAt: new Date('2020-01-01') })`, instead of relying on insert order.
