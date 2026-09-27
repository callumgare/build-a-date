# Link preview images for shared decks and plans

## Context
When a `/d/…` (deck) or `/p/…` (plan) link is pasted into a messaging app (iMessage, WhatsApp, Slack, Discord…), nothing shows but the title: there are no `og:image`/`twitter:*` tags anywhere and no `metadataBase`. We want a rich embed image:
- **Deck**: the deck's title, then its cards in a grid below, running off the bottom of the image when there are many, over the galaxy background.
- **Plan**: the same title and background, but the plan's picked cards fanned out like a hand of cards.

Both links are already public to anyone holding them (docs/deck-sharing.md, docs/plans.md § "Viewing a plan"), so an image of the deck name and card titles gives away nothing the link doesn't.

## Approach
Next's file convention `opengraph-image.tsx` in each route segment, rendered with `next/og` `ImageResponse` (Satori + resvg). `@opennextjs/cloudflare` 1.20.6 already patches `@vercel/og` for Workers (`dist/cli/build/patches/ast/patch-vercel-og-library.js`), so there's no need for extra deps. Size: 1200×630 PNG.

### Background: a pre-rendered still of the shader
The galaxy is WebGL2 only (`src/components/galaxy/render.ts` `createPainter`), so it can't run on the server. Its seed is fixed (`DEFAULT_SEED = 7`), so a still of it is exactly what the site looks like.
- Add `scripts/og-background.ts`, a Playwright script. It opens the running dev server's home page at a 1200×630 viewport, hides everything but `.galaxy-background`, turns off the sparkle layer, waits for the tiles to paint, and saves a JPEG (quality ~85) to `public/og/background.jpg`. Commit the output.
- Add an npm script `og:background` and document how to regenerate it (for example after palette or shader changes).
- Don't use `public/background.png`: it's the old 6.8 MB photo, not what the site shows now.

### Fonts
- Titles use Tan Pearl (`public/tan-pearl.otf`, which Satori can read).
- Satori has no system fonts, so add one OFL serif as a TTF for the card dates and as a fallback, e.g. `public/og/lora-regular.ttf`. Georgia can't be bundled.

### Loading assets
Add `src/lib/og/assets.ts` with `loadAsset(path): Promise<ArrayBuffer>`.
- It uses `getCloudflareContext({ async: true }).env.ASSETS.fetch(new URL(path, env.BETTER_AUTH_URL))`. `ASSETS` is already bound in `wrangler.jsonc`.
- If `ASSETS` isn't there (plain `next dev`), it falls back to a normal `fetch` of the same URL.
- Assets are cached in module scope per isolate.
- In tests, extend `src/test/cloudflare.ts` with an `ASSETS` stand-in that reads from `public/` with `fs`. This keeps the rule of mocking only the Cloudflare edge (docs/testing.md § "Stand-ins for server-only code").

### Drawing a card (`src/lib/og/card.tsx`)
A Satori-safe version of `Card`, fixed size and 3:4:
- Paper: `#f7f0e4` with the same gradient, a 1px `rgba(111,77,43,.28)` border, 6px radius, and a drop shadow.
- Frame: `frameFor(card.id)` from `src/components/frames.tsx`, drawn as one SVG. The top art sits at y=0, the rails are lines from `top.height` to `H − bottom.height`, and the bottom art is translated to `H − bottom.height`.
  - It's rendered with `renderToStaticMarkup` into an `<img src="data:image/svg+xml,…">`.
  - The `.fill`/`.faint` classes come from an inline `<style>`.
  - Stroke width is set in frame units to match the 1px look, instead of relying on `vector-effect`.
- Text: the title in Tan Pearl `#173d4c`, placed inside `frame.inset` and scaled to the card's width, then the date if there is one (`#947347`, uppercase).
  - There's no description: it would be unreadable at thumbnail size.
  - Titles step down in font size by length and are clamped to about 4 lines. Satori can't measure text like `useFitText` does.

### Layouts (`src/lib/og/layout.ts`, pure functions)
- `deckGrid(count)`: 6 columns of ~170×227 cards with 20px gaps, centred. The grid starts below the title (~y 170), so the second row is cut off by the bottom edge.
  - Only rows whose top is above 630 are drawn, at most 18 cards.
  - A single short row is centred.
  - Cards are in the deck's stored `position` order, as `getSharedDeck` returns them. We don't use a random shuffle, so the image stays the same between fetches.
- `planFan(count)`: cards of ~220×293 on an arc around a pivot well below the image.
  - Each card's centre is at `pivot + R·(sin θ, −cos θ)`, rotated by θ around its own centre (so we don't depend on Satori's `transformOrigin`).
  - The step is `min(12°, 64° / (n−1))`, symmetric about 0°. The first pick is leftmost and at the back, each card overlapping the one before.
  - The bottom of the hand runs slightly off the image.
  - At most 9 cards. With more, the fan uses the first 9.
- Title block for both: the deck name in Tan Pearl, `#f8f2e8` _(post-implementation, 2026-09-28, Claude at Callum Gare's request: changed to the heading gold `#e5bc81`)_, centred, ~64px, dropping to ~44px and 2 lines for long names. There's a faint gold (`#e5bc81`) rule or star beneath.

### Routes
- `src/app/(public)/d/[shareId]/opengraph-image.tsx` uses `getSharedDeck`. For `NotFoundError` it calls `notFound()`, the same pattern as `findDeck`.
- `src/app/(public)/p/[planId]/opengraph-image.tsx` uses `getPlan`. The fan shows every picked card in plan order: `cards` (the first row) followed by each group's `cards`.
  - For an empty plan (all its cards since removed), it shows just the title and background.
- `src/app/(public)/sample/opengraph-image.tsx` draws the sample deck (`src/data/sample-deck.ts`) as a grid. That's the demo link people are most likely to share.
- Each route exports `size`, `contentType = 'image/png'` and a static `alt`. Responses get `Cache-Control: public, max-age=3600`.
- Shared `renderShareImage({ title, cards, layout })` in `src/lib/og/render.tsx` builds the `ImageResponse`: the background `<img>`, the title and the cards.

### Metadata
- In the two pages' `generateMetadata` (`d/[shareId]/page.tsx:19`, `p/[planId]/page.tsx:21`) and `/sample`, add:
  - `metadataBase: new URL(env.BETTER_AUTH_URL)`, so the auto-added `og:image` is absolute
  - `openGraph: { title, description, type: 'website' }`
  - `twitter: { card: 'summary_large_image' }`
- Give the plan page a description, e.g. "The date ideas picked from {deck}."
- Twitter/X and others fall back to `og:image`, so no `twitter-image` file is needed.
- `/p/…/edit` and `/decks/…` are for editors and aren't shared, so they get no image.

## Tests (beside the files, citing the new doc)
- `src/lib/og/layout.test.ts`:
  - The grid is centred.
  - It cuts off at the bottom and draws no rows that start below 630.
  - The fan is symmetric, steps no more than 12°, caps at 9 cards, and keeps pick order left to right.
- `opengraph-image.test.tsx` for each route, against `createTestDb` with real `ImageResponse` rendering:
  - It returns `image/png`, and the PNG's IHDR is 1200×630.
  - An unknown id gives `NotFoundPage`.
  - A plan's picks across groups all feed the fan. Spy on `renderShareImage`'s input, or check the layout that's passed.
- Extend the existing `page.test.tsx` metadata tests for `/d`, `/p` and `/sample`: `metadataBase`, `openGraph` and `twitter.card`.
- e2e (`e2e/share-preview.spec.ts`):
  - The shared deck and plan pages have an absolute `og:image` meta.
  - Fetching it returns a PNG.
- Build check: run `npm run preview` (OpenNext build) and confirm the worker bundle is still under the Cloudflare size limit with resvg/yoga wasm added. Load the image through the preview worker to prove the patched `next/og` works on workerd.

## Docs
- New `docs/share-previews.md` covering:
  - what each image shows
  - the grid and fan rules
  - the pre-rendered background and how to regenerate it
  - fonts
  - `loadAsset`/`ASSETS`
  - the metadata, and why edit pages have none
- Add a row to the `AGENTS.md` docs table. Add a one-line mention in `docs/background.md`: the still in `public/og/background.jpg` must be regenerated when the shader or palette changes.
- Copy this plan to `docs/historical-plans/2026-09-28-share-previews.md`.

## Verification
1. `npm test`, `npm run typecheck` and `npm run lint`.
2. With `npm run dev`, open `/d/<shareId>/opengraph-image`, `/p/<planId>/opengraph-image` and `/sample/opengraph-image`. Check small decks (1–3 cards), big decks (30+), long titles, and plans with groups and more than 9 picks.
3. `npm run test:e2e`.
4. `npm run preview`: fetch the image from the workerd preview and check the bundle size in the wrangler output.
5. After deploying, paste a link into a messaging app (or use a preview debugger such as opengraph.xyz) to confirm the embed.

---

## Post-implementation notes

_Added 2026-09-28 by Claude (with Callum Gare), after building it, so the plan above isn't read as a description of the code. The plan itself is unchanged._

- The deck grid has 5 columns of 200×267 cards, not 6 of 170×227, so the second row is clearly cut off by the bottom edge. That makes at most 10 cards, not 18.
- The fan's step is at most 16° and it spans at most 72°, with its middle card's centre at y 410, not 12°/64°. At 12° a small hand hid half of each title.
- The fallback font is Lora SemiBold (`public/og/lora-semibold.ttf`).
- `/sample/opengraph-image` has `dynamic = 'force-dynamic'`. With no params, Next prerendered it at build time, when there's no Cloudflare context, and the build failed.
- In `next dev`, `ASSETS` is bound but serves the last OpenNext build, so `loadAsset` falls back to fetching from the site when `ASSETS` doesn't return the file, not only when `ASSETS` is missing.
- Satori fades `transparent` through black, so the card's gradients fade to `rgba(255, 255, 255, 0)`.
- The Worker is now about 3.25 MB gzipped, over the Workers Free plan's 3 MB limit.
- The background still is zoomed in (a 600×315 window at 2×, on a 2560×1440 screen) so that at thumbnail size the swirls look as big as on the site. The title is in the heading gold, not white. Both changed at Callum Gare's request.
- Under `next dev`, `loadAsset` now skips `ASSETS` altogether. It had served the old background from a stale `.open-next/assets` after the still was taken again.
