## Documentation

`docs/` holds per-feature/area documentation. Read the one that covers what you are touching. The summaries are writen to help indicate when it's likely useful for you to read. Reach for `AGENTS.md` when the material is more overview related, reach for `docs` when you want more indepth info relating to a specific feature/area.

| Doc                                                | Read it when                                                                                                                                                               |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [docs/deck-sharing.md](docs/deck-sharing.md) | Touching edit access, the `deck_access` table, Shared decks, who may change a deck, or the `next` redirect after sign-in |
| [docs/historical-plans/2026-09-24-deck-sharing.md](docs/historical-plans/2026-09-24-deck-sharing.md) | Wondering why deck sharing was built the way it was (frozen plan) |
| [docs/card-notes.md](docs/card-notes.md) | Touching the options on cards on `/d/…` (Add to plan/Discard and Notes, clicking a side of a card, the edit button and adding ideas for editors), the flip-over notes view, card ratings and notes (`interest`/`notes` on `card`), or `saveCardNotes` |
| [docs/historical-plans/2026-09-24-card-notes.md](docs/historical-plans/2026-09-24-card-notes.md) | Wondering why card notes were built the way they were (frozen plan) |
| [docs/deck-sorting.md](docs/deck-sorting.md) | Touching the **Sort by** options on `/d/…` (random, date added, interest), or `sortDeck` in `src/lib/deck-order.ts` |
| [docs/card-layout.md](docs/card-layout.md) | Touching how cards sit on `/d/…` (the tilt on hover, `randomTilt`/`leanOf`/`untiltedBox` in `src/components/tilt.ts`), or the plan track's padding |
| [docs/quick-add.md](docs/quick-add.md) | Touching the **Add an idea** / **Quick Add** controls (`AddCardControls`, `useCardEditor`), `quickAddCard`, `src/lib/quick-add.ts`, OpenRouter or `OPENROUTER_API_KEY` |
| [docs/historical-plans/2026-09-25-quick-add.md](docs/historical-plans/2026-09-25-quick-add.md) | Wondering why Quick Add was built the way it was (frozen plan) |
| [docs/testing.md](docs/testing.md) | Writing or fixing a test: where it goes, what's real, and the `src/test/` stand-ins for Next, Cloudflare and Better Auth |
| [docs/historical-plans/2026-09-25-test-coverage.md](docs/historical-plans/2026-09-25-test-coverage.md) | Wondering why the test suite is laid out the way it is (frozen plan) |

### Citing the documentation
If the docs provide some relevent and useful info about the behaviour or context of some code then you should cite the relevent section in a code comment. Citations should be in the form of `docs/<file>.md § "<heading>"`, optionally followed by `- <the specific claim>` where the section covers several.

Citing docs is especially important for tests which should cite the requirement they are testing whenever such a requirement is listed in the docs. For example:

```ts
/** @see docs/terminal-output.md § "Defaults decide what happens in tests" */
it("takes the default when nothing can answer the prompt", () => {
```

A test name says what the code does; the citation
says _why anyone decided it should_, so someone who breaks the test can go and
read the reasoning instead of guessing at it from the assertion - and someone
changing the documented behaviour can find every test that depends on it with a
grep.

When a whole `describe` block covers one requirement, cite it once on the block rather than on every test inside it.

Make sure you only cite a stated requirement. A test for something the docs do not claim needs no reference, and inventing one to fill the slot makes the docs look more prescriptive than they are.

### Maintenance

- A change should not be considered finished if there is wrong/out-of-date info in `docs/`.
- A change that adds a concept someone would need explained — a new dialect, a
  new attribute namespace, a new output style — gets it documented in the
  relevant doc, not only in code comments.
- A new doc gets a row in the table above.
- You should create new plans under `docs/historical-plans/`
- `AGENTS.md` itself changes when a repo-wide convention or invariant does: a
  new lint rule, a new mocking boundary, a new directory with rules of its own.
- Frozen plans under `docs/historical-plans/` are exempt from all of the above.
  They are not updated as the code moves on. If one has to be edited because it
  is actively misleading someone, mark the edit inline as post-implementation,
  dated, with who changed it and why — never a silent rewrite.

## Testing

Tests sit beside the file they test. Server code (actions, route handlers, pages) is tested against the real queries and an in-memory SQLite database. Only the request-bound edges are replaced: Next's `redirect`/`notFound`/`headers`/`cache`, the Cloudflare context and `getDb`, and Better Auth's `createAuth`. Use the stand-ins in `src/test/` for those, rather than mocking `src/lib/decks.ts` or `requireUser`. See [docs/testing.md](docs/testing.md) § "Stand-ins for server-only code".

## Creating Plans/Making Major Changes

Unless the user explicitly indicates otherwise the plan or major change should include:

- [ ] Adding full tests for all requirements.
- [ ] The plan file created in (or an exact copy put into) the `docs/historical-plans` directory with the filename `YYYY-MM-DD-title.md`.
- [ ] A docs/*.md file should be added when working on a feature that isn't covered by the existing docs, or if there is already an existing relevant doc it should be updated. If adding new feature that is a superset of an existing feature with an existing doc file consider renaming the existing file under the new superset feature name and placing it's existing contents into a new section dedicated to that subfeature.
- [ ] If the `docs/` file structure or any filenames in it have changed, AGENTS.md is updated so that every file is
  listed in the docs table and optionally if useful it's also linked in relevant sections elsewhere in the document (no
  more than 2 times).
- [ ] DB migration files should always be created with drizzle-kit rather than manually written and they should be given a meaningful name. E.g. drizzle-kit generate --name add_username_to_users.
