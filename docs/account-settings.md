# Account settings

`/settings` is where a signed-in person manages their account. It shows the email address they're signed in with, and lets them change their name, manage their passkeys and sign out. The page is `src/app/(app)/settings/page.tsx`. Someone who isn't signed in is sent to sign in first.

## Your name

The name is asked for when someone signs up. It's shown on Welcome, and it's how deck owners and editors see someone: in edit requests (and the email about them) and in a deck's list of editors (see [deck-sharing.md](deck-sharing.md)).

**Your name** in Settings changes it (`NameForm` in `src/components/auth/NameForm.tsx`).

- It's saved by the `updateName` server action in `src/lib/actions/auth.ts`, which hands it to Better Auth's `updateUser`. Like the sign-in form, it's a form action, so it works before the page's JavaScript has loaded, or without it.
- The name is trimmed. It can't be blank or more than 80 characters, the same limit as signing up. If it's turned away, the form keeps what was typed and says why.
- If the session has run out, the form asks them to sign in again rather than showing an error from Better Auth.
- Once it's saved, the form says so, and every page is revalidated so none of them show the old name.

## Passkeys and signing out

`AccountSettings` (`src/components/auth/AccountSettings.tsx`) lists the account's passkeys, with **Add a passkey** and a **Remove** button on each. It asks before removing one, and warns when it's the last one, since without it the person will need an email link to sign in. **Sign out** is a form action too.
