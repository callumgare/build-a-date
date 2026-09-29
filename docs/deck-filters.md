# Deck filters

On a shared deck (`/d/…`) and the plan edit page (`/p/…/edit`), the ideas in the deck can be narrowed down. The filters sit in a row labelled **Show**, in a fieldset announced as *Filter ideas*, with the **Sort by** buttons under them ([deck-sorting.md](deck-sorting.md)).

## All and the tags

- **All** is on when nothing else is. Pressing it clears every filter, **Not in plan** included.
- A tag button toggles its tag. An idea shows when it has **every** selected tag: one tag narrows the deck to that tag's ideas, two to the ideas with both. Pressing a tag turns **All** off without clearing the other tags.
- Only the tags used in the deck show, in alphabetical order.

## Not in plan

Hides the ideas one of the deck's saved plans has already used, its first row and its groups alike, so someone building another plan can see what's left. It sits after **All**, before the tags, with a wider gap setting it apart from them: it's about the deck's plans, not a tag.

- **It rules out All, not the tags.** Pressing it turns **All** off, and **All** clears it, but the tag filters carry on alongside it: an idea shows when it has every selected tag *and* no saved plan has used it.
- **Plans saved by anyone count.** Plans belong to the deck, not to whoever saved them ([plans.md](plans.md) § "Plans"), so every saved plan's cards are hidden, whoever built it.
- **It only shows once there's a plan.** Until the deck has a saved plan there's nothing for it to hide, so the button isn't offered. The sample deck can't have plans, so it never shows there ([sample-deck.md](sample-deck.md) § "What's different").
- **What the filters show is what everything else works on**: the sort puts it in order, **Draw random card** picks from it, and an empty deck says **No ideas match the filters.** with a **Show all ideas** link that clears every filter ([deck-sorting.md](deck-sorting.md) § "How it fits with filters and the plan").

## Where the planned ideas come from

`listPlannedCardIds` in `src/lib/decks.ts` collects every card in every saved plan, once each. Both `/d/…` and `/p/…/edit` pass it to the builder as `plannedCardIds`, for anyone opening the page, since anyone with the link can build a plan ([deck-sharing.md](deck-sharing.md) § "Who can do what") — unlike the plans list, which only the owner and editors see. On the edit page the plan being edited counts too: it's one of the deck's saved plans.
