# Deck sorting

On a shared deck (`/d/…`), the ideas that aren't in the plan can be put in a different order. The **Sort by** buttons sit in a row under the tag filters, which are labelled **Show**.

## Sort options

| Option | Order |
| --- | --- |
| **Random** (the default) | A new shuffle on every visit, with matching card frames kept apart. |
| **Date added** | Newest first. |
| **Interest** | Most stars first, then fewer. Unrated ideas go last. Ideas with the same rating go in order of title (A to Z, ignoring case, with numbers in number order so "Walk 2" comes before "Walk 10"). |

**Date added** uses the order the cards are stored in, which is `position` on the `card` table. A new card always goes on the end, and nothing reorders cards, so this is the order they were added in. There's no separate "added at" field.

**Interest** is the rating from the card's notes ([docs/card-notes.md](card-notes.md) § "Rating and notes"). Rating a card on this visit moves it to its new place straight away.

## How it fits with filters and the plan

- Sorting and the tag filters work together: the filters pick which ideas show, the sort puts them in order.
- Sorting only changes the deck. Cards in the plan stay in the order they were picked, and **select a random one** still picks at random from the ideas the filters show.
- The choice isn't saved. Every visit starts on **Random**.

## On the deck's own page

The **Ideas** grid on a deck's page (`/decks/…`) has no **Sort by** buttons. It always shows the most recently added ideas first, straight after the **Add an idea** spot, using the same `position` order as **Date added** above. A card that's just been added shows up at the front.
