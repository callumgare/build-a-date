# Testing

There are two suites. `npm test` runs Vitest over `src/**/*.test.{ts,tsx}`. `npm run test:e2e` runs Playwright over `e2e/`, against a server it starts itself (see `playwright.config.ts`). `npm run test:coverage` runs the Vitest suite and writes a coverage report to `coverage/`.

## Where each kind of test goes

| What's under test | Where the test lives | What's real |
| --- | --- | --- |
| Queries in `src/lib/decks.ts`, validation, email, ordering | Beside the file, e.g. `src/lib/decks.test.ts` | Everything, including the database: `createTestDb()` in `src/test/db.ts` builds an in-memory SQLite database from the same migrations D1 gets. |
| Server actions (`src/lib/actions/`), route handlers, server pages (`src/app/**/page.tsx`) | Beside the file, e.g. `src/app/(app)/decks/[deckId]/page.test.tsx` | The code under test, the queries, the test database, and `getSession`/`requireUser` from `src/lib/auth.ts`. Next's request-only functions, the Cloudflare context and Better Auth are stand-ins (see below). |
| Client components (`src/components/`) | Beside the component, with a `/** @vitest-environment jsdom */` docblock. A big one can be split by area, e.g. `PlanBuilder.picks.test.tsx` and `PlanBuilder.saving.test.tsx`, so the parts run side by side | The component and its children. Server actions it calls are mocked with `vi.mock('@/lib/actions/…')`. |
| Whole flows in a browser: passkeys, email links, forms without JavaScript, layout, animation | `e2e/` | Everything. It uses an OpenNext build on workerd, or `next dev` with `E2E_TARGET=dev`. Emails are read from the dev outbox (`/api/dev/outbox`). `e2e/helpers.ts` has `signUp`, `createDeck`, `latestSignInLink` and `outboxCount` for the usual setup. See [End-to-end tests](#end-to-end-tests). |

A page that only returns one component (like `/d/[shareId]` returning `PlanBuilder`) is tested by checking the props it hands that component. That covers who gets an edit link and who sees the access list, without rendering the whole component. A page with its own markup is rendered in jsdom, with any client components it contains stubbed where they'd get in the way.

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

- **`src/test/next.ts`** stands in for `next/navigation`, `next/headers`, `next/cache` and `next/server`. Like Next's own, `redirect()` and `notFound()` throw, so nothing after them runs. They throw a `RedirectError` whose message is `Redirected to <path>`, and a `NotFoundPage`, so a test can write `await expect(page()).rejects.toThrow('Redirected to /decks')`. Its `useRouter()` hands back `router`, whose `push`, `replace` and `refresh` are `vi.fn`s, for client components the page renders.
- **`src/test/cloudflare.ts`** stands in for `getCloudflareContext()` and `getDb()`. Its `env` is a local one (`http://localhost:3000`, no Resend key, so emails go to the outbox). `resetEnv({ … })` changes it for one test. For example, a production URL with no key makes `sendEmail` throw. Call `useTestDb(db)` in `beforeEach` to hand code the test database.
- **`src/test/jpeg.ts`** has `fakeJpeg()` and `fakeJpegBlob()`: just enough of a JPEG (its start, a JFIF header and a start-of-frame with a width and height) for the link preview checks in `src/lib/og/jpeg.ts`. jsdom can't draw, so component tests mock `@/lib/og/client` instead of drawing a real picture.
- **`src/test/session.ts`** stands in for `createAuth`, so the real `getSession` and `requireUser` run against whoever `signInAs(user)` signed in, or nobody after `signInAs(null)`. Its `api.listPasskeys` is a `vi.fn` to set per test.

Client component tests have a few of their own:

- **`src/test/media.ts`** has `mediaMatching(...queries)`, a `matchMedia` where only those queries match, e.g. `vi.spyOn(window, 'matchMedia').mockImplementation(mediaMatching('(hover: hover)'))` for a mouse. Use it rather than a hand-made object: Motion listens for changes the first time it's asked, once per file, so a stand-in without `addEventListener` breaks whichever test happens to render first.
- **`src/test/plan-builder.tsx`** has what the `PlanBuilder.*.test.tsx` files share: a small deck, `renderBuilder`, the picks kept in storage, and `resetPlanBuilder()` for `beforeEach`. The stand-ins for the actions, router, `Link` and preview drawing it talks to are in **`src/test/plan-builder-mocks.tsx`**, which each file mocks with, e.g., `vi.mock('@/lib/actions/plans', () => import('@/test/plan-builder-mocks'))`.

Better Auth itself is only real in `src/lib/auth-config.test.ts` and the e2e tests. The action tests for `sendSignInLink` and `signOut` mock `getAuth` directly, to check what's passed to Better Auth and how its errors are handled.

## Gotchas

- **`next build` type-checks test files too**, so a type error in a test breaks the e2e build (and a deploy). Run `npm run typecheck` before `npm run test:e2e`.
- **`userEvent` hangs under `vi.useFakeTimers()`**, even with `advanceTimers` set. For debounced behaviour (like notes saving 0.7s after typing stops), use `fireEvent` inside `act` with fake timers, rather than waiting out the real delay.
- **Use `userEvent.setup({ delay: null })`.** The default waits a tick between keystrokes, which adds up over a few words and hides nothing worth testing. For long text that isn't the point of the test, click the field and `user.paste(…)`.
- **Waiting on nothing.** Without the tick between events, a check that something *didn't* happen can run before the handler has finished, and pass whatever the code does. Wait for something that shows it has finished (a button enabled again), or for the mocked promise to settle inside `act`, before checking.
- **A hook that returns a function gets that function called as cleanup.** Vitest treats a function returned from `beforeEach` as a teardown hook. So `beforeEach(() => mock.mockResolvedValue(x))` without braces returns the mock, which then gets called after the test. Use braces.
- **Motion's animations are skipped in jsdom** (`MotionGlobalConfig.skipAnimations` in `src/test/setup.ts`), so fades, flips and flights jump to their end and an element leaving through `AnimatePresence` goes straight away. How things move is checked in e2e.
- **Each test file gets its own modules.** The stand-ins keep state at module level (who's signed in, the test database, the outbox), so Vitest's `isolate: false` breaks tests that pass alone.

## End-to-end tests

- **Use the sample deck when a builder is all a test needs.** `/sample` is the same `PlanBuilder` with the same starter ideas as a new deck, and needs no one to sign up ([sample-deck.md](sample-deck.md)). Sign up and make a deck only for what the sample deck doesn't do: saving a plan or notes, the deck's plans, editing it, or sharing it.
- **Every test stands alone**, so they all run side by side (`fullyParallel`). Each makes its own accounts (with unique emails, and its own visitor IP, see `e2e/fixtures.ts`) or uses the sample deck. The server starts from an empty database each run.
- **It's a busy machine.** A test can take 60s before it times out, and a check (`expect`) 15s, as the longest flows (sign up, share, save a plan, edit it) take longer when everything else is running too. Passing checks still return straight away. Adding workers (`--workers=10`) should only make the run faster or slower, never fail it.
- **No WebGL, unless the test is about the background.** The test browsers draw WebGL in software (SwiftShader), and the galaxy background kept each page's main thread busy a third of the time; with several browsers at once, pages starved and tests timed out. The fixtures turn WebGL off, so the background is its plain colour ([background.md](background.md) § "Fallback"). `test.use({ galaxy: true })`, or `newVisitor(browser, { galaxy: true })`, turns it back on, as `background.spec.ts` does.
- **Find elements by role, label or a `data-*` hook, never by class.** Class names come from CSS modules and change from build to build. Use `getByRole` or `getByLabel` where there's a role or label, and otherwise the `data-*` attribute put there for it ([ui-components.md](ui-components.md) § "Hooks for code and tests"), like `[data-plan-row]` or `[data-column="plan"]`. The same goes for unit tests' `querySelector`.
- **Press a card's options with `pressOption`** (`e2e/helpers.ts`), from the keyboard, rather than hovering the card and clicking. Hovering tilts the card, and Playwright waits for it to hold still before clicking; on a page drawing few frames that can take longer than the test has. Tests about using a card with the mouse still hover and click.

### Waiting for the page's script

A page does nothing when clicked until React has taken it over, which on a busy machine can be seconds after it loads, and the click is lost. `HydratedMark` in the root layout marks `<html data-hydrated>` once it has, and the fixtures in `e2e/fixtures.ts` wait for it (import `test` and `newVisitor` from there, not from `@playwright/test`):

- `goto` and `reload` return once the page has taken over.
- A page loaded any other way (a form sent before the page had taken over, a redirect) is covered by an invisible layer, outside `<body>`, until it has. A click or hover waits for it, as Playwright waits for anything covering what it's about to press.

Clicking a link to another page in the app needs no wait, since React is already running.

### Checking animation

Tests that watch something move record it frame by frame with `requestAnimationFrame` inside the page. How many frames a busy machine draws is up to it, so:

- **Press the button from inside the page**, in the same `evaluate` that starts watching, so no frame is missed.
- **Don't ask for a number of frames.** Ask for a few part way, that an animation was running (`element.getAnimations()`), or for where it started and ended.
- **Compare with where things are on the same frame.** Things around the moving element can move afterwards.
- **Wait for the page to be still, rather than sleeping**, before measuring where something starts or once it should have finished: `expectStill(page)` in `e2e/helpers.ts` waits until no switch between columns is under way, no CSS transition or animation is running in the builder, and every card has been in the same place for several frames (Motion's springs and slides are only seen that way). A fixed sleep is only for watching that something *doesn't* happen for a while.

### Known bugs

A test of something the docs promise that doesn't work yet is kept, marked `test.fail(…)` with why. It passes while the bug is there and fails once it's fixed, as a reminder to take the mark off.

## Timestamps in tests

Rows made one after another in a test often get the same `created_at` or `updated_at`, down to the millisecond. A test of ordering sets the timestamps it depends on explicitly, e.g. `db.update(plan).set({ createdAt: new Date('2020-01-01') })`, instead of relying on insert order.
