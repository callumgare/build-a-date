# Deck sharing

A deck's share link (`/d/…`) lets anyone build a plan from it. The same page also lets someone ask the owner if they can help **edit** the deck. If the owner says yes, the deck shows up under **Shared decks** on the other person's `/decks` page.

## Who can do what

| | Build a plan | Add, edit and delete ideas | See the deck's plans | Rename or delete the deck | Answer requests, remove editors |
| --- | --- | --- | --- | --- | --- |
| Anyone with the link | ✓ | | | | |
| Editor (an accepted request) | ✓ | ✓ | ✓ | | |
| Owner | ✓ | ✓ | ✓ | ✓ | ✓ |

A pending request gives nothing beyond what anyone with the link already has.

Card changes go through `getEditableDeck` (owner or editor). Owner-only changes go through `getOwnedDeck`. Both are in `src/lib/decks.ts`, and both throw `NotFoundError` for anyone else, so a deck you can't edit looks the same as one that doesn't exist.

Access lives in the `deck_access` table: one row per deck and person, with status `pending` or `accepted`. The owner never has a row.

## Asking for edit access

1. The footer of `/d/[shareId]` shows **Request edit access**. Owners and editors see **Edit this deck** instead, and someone who has already asked sees that they have.
2. The link goes to `/d/[shareId]/request`. Someone who isn't signed in is sent to sign in first, and can make an account from there (see [Returning after sign-in](#returning-after-sign-in)).
3. That page asks them to press **Send request**. It tells them their name and email address go to the owner.
4. The owner is emailed, with a link to the deck's page. The email only goes out the first time someone asks. Asking again, or asking for a deck you own or already edit, changes nothing.
5. If the email fails to send, the request is still saved and still shows on the deck's page. The error is logged, and the person asking doesn't see it.

## Why sending takes a press

Opening `/d/[shareId]/request` never sends a request by itself. You have to press the button, which runs a server action (a POST). If simply visiting the page sent the request, another site could link someone to it. That would send a request in their name, and the deck's owner would learn their name and email address.

## Answering requests

The owner sees pending requests near the top of the deck's page, with **Accept** and **Decline**.

- Accepting makes the person an editor.
- Declining deletes the request, so they can ask again later.
- A request that has already been answered can't be answered again, and nobody can be accepted without having asked.

## Removing and leaving

The owner's deck page lists editors at the bottom, each with **Remove**. An editor sees **Leave deck** in place of Rename and Delete. Either way the row is deleted, so the person can ask again. Deleting the deck, or either person's account, deletes its access rows too.

## Shared decks

`/decks` lists your own decks, then the ones you've been accepted to edit under **Shared decks**. Each shows the owner's name. Pending requests don't appear there. Instead, your own decks show a count of pending edit requests.

## Returning after sign-in

Sign-in can take someone back to where they were. `/sign-in`, `/sign-up` and `/welcome` take a `next` path, and `requireUser(next)` adds one when it sends someone to sign in. It's carried through each way of signing in:

- With a passkey, they go straight to `next`.
- With an email link, `next` rides along in the magic link's callback URL: `/welcome?next=…`.
- Welcome then sends them on to `next`. It does that whether they create a passkey, skip, or already have one.

`safeNextPath` in `src/lib/validation.ts` only accepts paths on this site. It rejects `//host`, backslashes and control characters, since browsers can turn those into a link to another site. Without that check, a crafted sign-in link could redirect people anywhere.
