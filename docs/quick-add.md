# Quick Add

Quick Add fills in a new card from a line or two of free text, or just a link. A model on [OpenRouter](https://openrouter.ai) reads what was typed, plus the pages it links to, and writes the card in the style of the deck's other cards. The code is `src/lib/quick-add.ts`, the `quickAddCard` action in `src/lib/actions/decks.ts`, and `src/components/decks/QuickAdd.tsx`.

## Adding an idea

The first spot in the **Ideas** grid on a deck's page (`/decks/…`) has no outline, just three things stacked in the middle:

1. **Add an idea** opens the empty **New idea** form, as before.
2. An **or** between two short rules, the same divider as under **Pick a card below** on `/d/…`.
3. A **Quick Add** button, which opens a dialog with one box to type into.

The same three things take the last spot in the deck on the shared deck (`/d/…`) for owners and editors (see [card-notes.md](card-notes.md) § "Editing a card"). Both are `src/components/decks/AddCardControls.tsx`, and `useCardEditor` in `src/components/decks/useCardEditor.tsx` wires Quick Add to the card form on both pages.

Pressing **Fill in the details** sends the text off. While it's working the button says **Filling in…**, and it usually takes a few seconds, longer when there are pages to read. When it's done, the Quick Add dialog closes and the usual **New idea** form opens with the fields filled in. If it can't fill anything in, the dialog stays open with the reason and the text still in the box.

Anyone who can edit the deck can use it, the owner or an editor (see [deck-sharing.md](deck-sharing.md) § "Who can do what").

## What someone can type

Anything from a full description to a bare link:

- `Boat Hire at Fairfield Boathouse, open on wednesdays https://fairfieldboathouse.com/`
- `https://www.themoth.org/`
- `stargazing somewhere dark`

## Links

Up to the first three links in the text are fetched, and each page is boiled down to its title, its description tags (`description`, `og:title`, `og:description`, `og:site_name`) and its visible text, capped at 6,000 characters. Scripts, styles and markup are thrown away.

A page that can't be read (it's down, it answers with an error, it takes more than 8 seconds, or it isn't HTML or text) doesn't stop the rest. The model is told the page couldn't be read and works from the text instead. Only `http` and `https` links are fetched, and the worker's `global_fetch_strictly_public` flag (in `wrangler.jsonc`) stops a link from reaching anything that isn't on the public internet.

## Matching the deck's style

The model is shown every card already in the deck (up to 40) and the list of tags the deck uses, and asked to:

- write the title in Title Case, usually the activity or the place;
- keep the description as short as the others, usually a sentence then the link as `[More info](…)`, and never make up anything the text or pages don't say;
- pick tags from the deck's existing ones, and only add a new tag when none fit;
- fill in **When** only when something says when it's on or open.

A deck with no cards yet has no style of its own, so the starter cards (`src/data/starter-cards.ts`) and their tags stand in.

## What comes back

A draft of the card's four fields, trimmed to what the card form accepts (title 80 characters, description 1,000, **When** 80, up to 8 lowercase tags of 24 characters each). Nothing is saved: the draft only fills in the form, and the card is made when someone presses **Save**, the same as any other card. The next **Add an idea** starts empty again.

Models sometimes wrap the JSON in a code fence or a sentence, so the reply is read from its first `{` to its last `}`. A reply with no JSON in it shows **Couldn’t make sense of that. Try adding a little more detail.**

## Setting it up

| Setting | What it's for |
| --- | --- |
| `OPENROUTER_API_KEY` | A secret: `wrangler secret put OPENROUTER_API_KEY` for production, `.dev.vars` locally. Without it, Quick Add says **Quick Add isn’t set up on this server yet.** and calls nothing. |
| `OPENROUTER_MODEL` | Optional. Any OpenRouter model slug. Defaults to `DEFAULT_MODEL` in `src/lib/quick-add.ts` (`google/gemini-2.5-flash`), which is quick and cheap and handles JSON output well. |

If OpenRouter can't be reached, answers with an error (such as running out of credits or being rate limited), or takes more than 45 seconds, the dialog says **Couldn’t reach the helper just now. Try again in a moment.** and the details are logged on the server.

## Testing

`src/lib/quick-add.test.ts` hands `extractIdea` a stand-in for `fetch` that serves pages by URL and OpenRouter's reply, so nothing leaves the machine. The action tests in `src/lib/actions/decks.test.ts` stub the global `fetch` the same way. The e2e tests don't use Quick Add, since they'd need a real OpenRouter key.
