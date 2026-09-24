# Plan: deck sharing with edit access (2026-09-24)

## Request

Visiting a `/d/xxxx` link should offer a way to request edit access. If the visitor isn't signed in, they should be able to sign in or sign up, and then the request goes to the owner. If the owner accepts, the deck appears in the requester's account under "Shared decks".

## Approach

- [x] **Schema**: a `deck_access` table (`deck_id`, `user_id`, `status` pending/accepted, timestamps), keyed on (deck, user) and indexed on user. The migration is generated with `drizzle-kit generate --name add_deck_access`.
- [x] **Queries** (`src/lib/decks.ts`):
  - `getEditableDeck` covers the owner and accepted editors. Card save and delete now use it in place of `getOwnedDeck`.
  - `getAccessState`, `getSharedDeckWithOwner` and `requestEditAccess`. `requestEditAccess` is idempotent and reports whether the request is new.
  - `listDeckAccess`, `respondToAccessRequest`, `removeEditor` and `leaveDeck`.
  - `listSharedDecks`, plus a pending-request count on `listDecks`.
- [x] **Returning after sign-in**: `next` is carried through `/sign-in`, `/sign-up`, the magic link callback and `/welcome`, and `safeNextPath` validates it. `requireUser(next)` adds it when sending someone to sign in.
- [x] **Request page** `/d/[shareId]/request`, in the `(app)` group so it has the site header. It needs sign-in, and sends the request only on a button press (a server action), never just by being opened.
- [x] **Owner email** (`editRequestEmail`), sent once per new request. A failure is logged rather than shown, because the request is saved either way.
- [x] **UI**:
  - A footer link on the shared deck page.
  - Requests (Accept/Decline) and editors (Remove) on the owner's deck page.
  - Leave deck for editors, who don't see Rename or Delete.
  - A Shared decks section on `/decks`.
- [x] **Tests**:
  - Unit tests for every access query and permission boundary, `safeNextPath` and the email template.
  - An e2e test for the whole flow: a visitor who is signed out asks, signs up, sends the request, the owner accepts from the email link, and the visitor edits the deck.
- [x] **Docs**: `docs/deck-sharing.md`.

## Decisions

- **Sending takes one press after signing in**, rather than happening automatically. If a GET sent the request, any site could link someone to the page and pass their name and email to the deck owner (see `docs/deck-sharing.md` § "Why sending takes a press").
- **Editors can edit cards and see plans, but not rename, delete or manage access.** Those stay with the owner.
- **Declining and removing delete the row**, so the person can ask again. There's no permanent block list. It could be added if spam turns out to be a problem.
- **The requester isn't emailed when accepted.** The deck just appears under Shared decks. An email would be easy to add later.

## Also fixed

`npm run db:migrate:e2e` named the database `build-a-date`, but in the `e2e` wrangler environment it's `build-a-date-e2e`. Wrangler then looked for migrations in the default `migrations/` folder, and the e2e server wouldn't start.
