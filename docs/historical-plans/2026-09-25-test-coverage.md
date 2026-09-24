# Plan: fill the gaps in test coverage (2026-09-25)

## Request

Review all the code for parts, features and code that no test covers, then add tests for everything the review found.

## What the review found

The data layer (`src/lib/decks.ts`, validation, email, deck ordering) and `DeckBuilder` were well tested. The gaps were:

1. **Documented requirements with no test.** The owner's email about an edit request only going out the first time, and a failed email still saving the request. Asking for a deck you already edit. Access rows going when an account is deleted. `next` being carried through magic links, passkey sign-in and Welcome. Notes saving on blur and on page hide, and saves running one at a time. Notes not showing on plans. Plan cards keeping their order while sorting. The **Edit this deck** footer. Opening the request page not sending a request by itself.
2. **Untested server code**: every server action except `sendSignInLink`, `fail()` in `actions/result.ts`, the dev outbox route (which must 404 outside localhost, or it would hand out sign-in links), and the redirects in the server pages.
3. **UI with no test**: `CardEditor`, `DeckEditor`, `DeckAccess`, `AccountSettings`, `AddPasskeyButton`, `SignInForm`, `SharePlanButton`, `InstallHint`, and several `DeckBuilder` paths (Clear plan, several tags at once, the no-match message, `navigator.share`, copying the link).
4. **Low priority**: `spreadFrames` with too few frames, `editRequestEmail` without a name, list ordering, `deckInput`, and `passkeyName`/`wasCancelled`.

## Approach

- [x] **Queries** (`src/lib/decks.test.ts`): asking again as an editor, answering a request twice, access rows going with either account, and ordering of decks, plans and access lists.
- [x] **Server actions** (`src/lib/actions/*.test.ts`): every action, against the real queries and the test database. That includes the edit-request email being sent once and a failed email being logged while the request is still saved.
- [x] **`requireUser`** (`src/lib/auth.test.ts`) and the **dev outbox route**.
- [x] **Server pages** (`src/app/**/page.test.tsx`): `/`, `/sign-in`, `/sign-up`, `/welcome`, `/decks`, `/decks/[deckId]`, `/d/[shareId]`, `/d/[shareId]/request` and `/p/[planId]`.
- [x] **Stand-ins** in `src/test/` for Next (`next.ts`), the Cloudflare context and `getDb` (`cloudflare.ts`), and Better Auth (`session.ts`), documented in `docs/testing.md`.
- [x] **Coverage**: `@vitest/coverage-v8` and `npm run test:coverage`.
- [x] **Components**: tests for every component in point 3, the `CardNotes` saving behaviour, and `EmailLinkForm` carrying `next`. Some things can't be checked in jsdom and are left to the e2e tests: plan cards leaving the page after **Clear plan** (motion's exit animation never finishes in jsdom), and where the notes card starts its flip.
- [x] **E2E**: the forms that work without JavaScript (Send request, Leave deck), passkey sign-in and Welcome carrying `next`, notes not showing on plans or the edit page, keyboard use of the card options, the notes view's size, click-beside and reduced motion, managing a deck through the UI, and not-found pages.
- [x] **Docs**: `docs/testing.md`, and a Testing section and two table rows in `AGENTS.md`.

## Decisions

- **Server code is tested against the real queries and database, with only the request-bound edges replaced.** The alternative was to mock `src/lib/decks.ts` and `requireUser` in action and page tests. That would test that an action calls a query, not what happens to the data. It would also duplicate `requireUser`'s redirect logic in a mock. So the stand-ins sit lower down: `createAuth` is faked, and the real `getSession` and `requireUser` run on top of it.
- **Stand-ins are modules loaded with `vi.mock(…, () => import('@/test/…'))`.** A `vi.mock` only applies to its own file, so each test file lists the ones it needs. Loading them from a shared module keeps them identical everywhere.
- **`redirect()` and `notFound()` throw**, as Next's do. So code after them doesn't run, and a test asserts `rejects.toThrow('Redirected to /decks')`.
- **Pages that return a single component are tested by the props they hand it**, instead of rendering the whole client component. That's how `editHref` (the deck's own id) was checked to go only to owners and editors.
- **Tests that depend on ordering set their timestamps explicitly.** Rows made within one millisecond tie, so ordering by `created_at` alone was flaky in a first draft.
- **The `CardNotes` timer tests use `fireEvent` with Vitest's fake timers, not `userEvent`.** Under fake timers `userEvent` hangs, even with `advanceTimers` set. The likely cause is that Testing Library only recognises Jest's fake timers.
- **The e2e test of signing in with a passkey turns off passkey autofill on its page.** Chrome's virtual authenticator answers the autofill prompt by itself, so it signed the test in before the steps under test ran. A person would have to choose the passkey. Autofill itself is covered only by the `SignInForm` component test.
- **The 540px limit on the notes card is tested on a 1400×1100 viewport.** On Playwright's default 1280×720, the window's height limits the card first.
- **Two tests were checked against deliberately broken code** (always emailing the owner, and giving `editHref` to anyone who had asked). Both failed as they should, and the code was restored.
