# Sample deck

Someone who isn't signed in can try the builder before making an account. The home page (`/`) has two primary buttons:

- **Try a sample deck** goes to `/sample`, the builder for a sample deck.
- **Make your own deck** goes to `/sign-up`.

There's **- or -** between them.

**Sign in** is still there as a text link beside them. Someone signed in never sees the home page; it sends them to `/decks`.

## The deck

The sample deck is called **Sample Deck** and holds the starter ideas (`starterCards` in `src/data/starter-cards.ts`), the same ones a new deck can start from. It lives in `src/data/sample-deck.ts`, not in the database, so there's no share link, owner or editors, and nothing done with it reaches the server. Each card's id is its title in lower case with dashes (`picnic-in-the-park`).

The page is `src/app/(public)/sample/page.tsx`. It renders the usual shared-deck builder (`PlanBuilder`, with `sample`), shuffled afresh on each visit, with **A sample deck to try out. Pick the ideas you like best to make a plan.** under the deck's name. Anyone can open it, signed in or not.

## What's different

Everything works as on a shared deck (`/d/…`): picking, discarding, reordering, groups, filtering, sorting and notes. Except:

- **No saving a plan.** In place of **Save plan** it says **To save a plan**, followed by a **Create your own deck** button, which goes to `/sign-up`, the same place as **Make your own deck** on the home page. It shows when **Save plan** would (once something is in the plan), beside **Clear plan**. Sign-up sends someone already signed in on to `/decks`.
- **Notes aren't saved.** Ratings and notes can be set, and are jotted on the card as usual ([card-notes.md](card-notes.md) § "Rating and notes on the card"), but only for as long as the page is open. Nothing says **Saving…** or **Saved**. `CardNotes` saves nothing when it's given no `shareId`.
- **No footer.** There's no **Request edit access** or **Edit this deck**, as there's no deck to edit.
- **The sort isn't remembered**, even for someone signed in ([deck-sorting.md](deck-sorting.md) § "Remembering the choice").

The picks in progress are kept in the browser as on any deck ([plans.md](plans.md) § "Picks are kept in the browser"), under `build-a-date:picks:deck:sample`.
