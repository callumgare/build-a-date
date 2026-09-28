# Link previews drawn in the browser

## Context
The first version drew link-preview images in the Worker with `next/og` (Satori + resvg). On the Workers Free plan that broke production:
- The Worker grew to 3.25 MB gzipped.
- Every request now fails with "Worker exceeded CPU time limit" (10 ms on Free) or `ComponentMod.handler is not a function`.
- Drawing a 1200×630 image takes far more than 10 ms of CPU anyway.

The user chose to stay on the Free plan. So **the browser draws the preview and uploads it**, and the Worker only stores and serves bytes. What each picture shows stays the same:
- deck: the title in gold with the halo, over the zoomed-in galaxy still, and a grid of cards running off the bottom
- plan: the same, with the picks fanned out like a hand

## 0. Restore production first (needs the user's go-ahead)
`CLOUDFLARE_ENV= npx wrangler rollback 1ad96806-10fd-435f-ba21-37289d900285`, the 26 Sep version, then check that `/`, `/sample` and `/d/…` return 200. The new version is only deployed by the user, after review.

## 1. Take out server-side drawing
- Delete:
  - the three `opengraph-image.tsx` files and their tests
  - `src/lib/og/render.tsx` and `src/lib/og/assets.ts` (and its test)
  - `src/test/png.ts`, and the `ASSETS` stand-in in `src/test/cloudflare.ts`
- Keep the pure parts, which the browser reuses: `src/lib/og/layout.ts`, `src/lib/og/card.tsx` (`PreviewCard`, `frameSvg`, `titleScale`) and their tests.
- Check with `wrangler deploy --dry-run` that the Worker is back to about 2.5 MB gzipped, with no `resvg.wasm` or `yoga.wasm` in the output.

## 2. Drawing in the browser: `src/lib/og/draw.tsx` (client only, loaded with a dynamic `import()`)
- Add `satori` as a dependency.
- `drawSharePreview({ title, cards, layout }): Promise<Blob>`:
  1. Fetch `/og/background.jpg`, `/tan-pearl.otf` and `/og/lora-semibold.ttf`, and cache them in the module.
  2. Build the same tree `render.tsx` built: the background `<img>`, the title with `BACKGROUND_TEXT_SHADOW`, and the `PreviewCard`s placed by `deckGrid`/`planFan`. Move that tree into a pure `src/lib/og/preview.tsx` (`PreviewImage`), so it can be tested without a browser.
  3. `satori(tree, { width: 1200, height: 630, fonts, loadAdditionalAsset })` turns it into an SVG. Emoji are fetched as Twemoji SVGs from cdn.jsdelivr.net, only when a title has them.
  4. Draw the SVG onto a 1200×630 `<canvas>` through an `<img>` (`await img.decode()`), then `canvas.toBlob('image/jpeg', 0.85)`, about 200–300 KB.
- **Risk:** Safari has had trouble drawing an SVG with nested `data:` images onto a canvas. Check it with Playwright WebKit (step 7). If it fails, rasterise with `@resvg/resvg-wasm` instead, loaded only when drawing. Same output, but about 530 KB more to download.
- `src/lib/og/preview-key.ts` (pure, used by both server and client): `previewKey({ title, cards, layout })`.
  - It's a synchronous 53-bit hash (cyrb53) of `DRAWING_VERSION`, the layout, the title, and the id, title and date of the cards that are actually drawn (the first 10 in a grid, 9 in a fan).
  - Adding an 11th card to a deck doesn't change the key. Bump `DRAWING_VERSION` whenever the drawing changes.

## 3. Storage: D1
- New tables in `src/db/schema.ts`:
  - `deck_preview` (`deck_id` PK, FK to `deck`, cascade; `key` text; `image` blob; `updated_at`)
  - `plan_preview` (`plan_id` PK, FK to `plan`, cascade; same columns)
- Generate the migration with `drizzle-kit generate --name add_share_previews`.
- Queries in `src/lib/decks.ts`:
  - `getPreviewKey(db, 'deck' | 'plan', id)` selects only the key, for the page's metadata.
  - `getPreviewImage(db, kind, id)`
  - `savePreview(db, kind, id, key, image)`, an upsert
  - `deckPreviewInput(deck, cards)` / `planPreviewInput(plan…)` build `{ title, cards, layout }` from what `getSharedDeck`/`getPlan` return. The plan version flattens the first row plus each group's cards.
- `checkPreviewImage(bytes)` in `src/lib/og/jpeg.ts` checks that the upload is a JPEG (starts `FF D8 FF`), that its SOF marker says 1200×630, and that it's at most 1 MB.

## 4. Uploading
- `saveDeckPreview(deckId, key, image: Blob)` in `src/lib/actions/decks.ts`. It needs the owner or an editor (`getEditableDeck`). A deck viewer can't set its picture, just as they can't edit it.
- `savePlanPreview(planId, key, image)` in `src/lib/actions/plans.ts` is public, like the plan itself (docs/plans.md § "Who can edit a plan").
- Both recompute the current key on the server from the database. They store the image only if it matches the key the client sent and passes `checkPreviewImage`. Otherwise they return an `ActionResult` error, and nothing is stored.
- **Plans are drawn at save time**, so the picture is ready when the share dialog opens.
  - `PlanBuilder.sharePlan()` (`src/components/PlanBuilder.tsx` ~l.457) draws the preview from the picks before calling `savePlan`/`updatePlan`. It passes `{ key, image }` as a new optional last argument, and the action stores it after saving, with the same checks.
  - Drawing is capped at 5 s. If it's slow or fails, the plan saves without a picture, and the refresher below tries again on the plan page.
  - The fonts, background and satori start loading as soon as the first card is picked, so by the time Save is clicked the picture draws quickly.
- **Everything else goes through a refresher**: `SharePreviewRefresher` (`src/components/SharePreviewRefresher.tsx`, client).
  - The server works out `stale = storedKey !== currentKey` and passes `stale` and `input`. When stale, the refresher draws and uploads after the page is idle.
  - It's debounced by 2 s and reruns when `currentKey` changes, since card and rename actions revalidate the page. Errors are only logged.
  - It's mounted on `/decks/[deckId]` (where owners copy the share link, so a deck is redrawn as they edit it), on `/d/[shareId]` for owners and editors, and on `/p/[planId]` for anyone.

## 5. Serving
- `src/app/(public)/d/[shareId]/preview/route.ts` and `src/app/(public)/p/[planId]/preview/route.ts` (`GET`):
  - They read the stored image and return it as `image/jpeg`.
  - When `?v` is the stored key: `Cache-Control: public, max-age=31536000, immutable`. Otherwise `max-age=300`.
  - 404 when there's no deck/plan or no picture.
  - No drawing happens here, just a D1 read.
- `shareMetadata()` (`src/lib/og/metadata.ts`) takes an `image` address and sets `openGraph.images` (with width, height, `image/jpeg` and alt) and `twitter.images`.
  - The address is `/d/<shareId>/preview?v=<storedKey>`. When an older picture is stored, it's used until the new one arrives.
  - With no picture stored yet, it's `/og/default.jpg`.
  - The `?v` means a changed picture gets a new address, so messaging apps fetch it again.
- **Static pictures:**
  - `public/og/sample.jpg`: the sample deck's grid, used by `/sample`.
  - `public/og/default.jpg`: the galaxy, the gold "Build-a-Date" title and no cards.
  - Both are made by a dev-only page, `src/app/dev/previews/page.tsx`. It's a 404 unless `BETTER_AUTH_URL` is localhost, like `usesOutbox` in `src/lib/email.ts`. The page draws them with `drawSharePreview` and shows them as `<img>`s.
  - `scripts/og-background.ts` becomes `scripts/og-images.ts` (`npm run og:images`). It takes the background still, then saves the two pictures from that page.

## 6. Docs
- Rewrite `docs/share-previews.md` covering:
  - why the browser draws (the Free plan's CPU limit)
  - the key and when it's redrawn (at save, and by the refresher)
  - who can upload, the checks, storage and serving
  - the static pictures and `npm run og:images`
  - that until the first visit after a change, the preview is the old picture or the default
- Update its row in `AGENTS.md`, and mention the refresher in `docs/plans.md` § "Sharing a plan" and in `docs/deck-sharing.md`.
- Add a new frozen plan, `docs/historical-plans/2026-09-28-browser-drawn-previews.md`. Add a dated, marked post-implementation note to `2026-09-28-share-previews.md` saying it was replaced, and why.

## 7. Tests (cite `docs/share-previews.md` sections)
- `preview-key.test.ts`:
  - The key is stable.
  - It changes with the title, and with the id, title and date of drawn cards.
  - It doesn't change for cards past the ones drawn.
- `jpeg.test.ts`: accepts a 1200×630 JPEG, and rejects a PNG, the wrong size, and anything over 1 MB.
- `decks.test.ts`: storing and reading a preview (blob round trip in SQLite), the upsert, and the cascade when a deck or plan is deleted.
- Action tests:
  - A deck preview needs an owner or editor.
  - A stale key or a bad image is refused.
  - A plan preview is public.
  - `savePlan`/`updatePlan` with a preview store it, and without one still save.
- Route tests: bytes and `content-type`, both cache headers, and 404s.
- Page metadata tests: the stored-preview address with `?v`, the default when there's none, and `/og/sample.jpg` for `/sample`.
- `SharePreviewRefresher.test.tsx` (jsdom, with `@/lib/og/draw` mocked):
  - It draws and uploads only when stale.
  - It debounces, and redraws when the key changes.
  - It swallows failures.
- `PlanBuilder.test.tsx`: the preview is passed when drawing works, and the plan saves without one when drawing fails or times out.
- `e2e/share-preview.spec.ts` (real browser, real D1 on workerd):
  - Save a plan, read `og:image`, and fetch it: it's a 1200×630 JPEG, not the default.
  - For a deck, the owner opens `/decks/…`, and `/d/…`'s `og:image` then comes back as a drawn JPEG.
  - Run the plan case once under WebKit too (`npx playwright test --project webkit` with a temporary project, or `browserName: 'webkit'` in that spec) to settle the Safari risk.
- Look at the drawn JPEGs by eye: the deck grid, fans of 1, 3 and 12, and a long title.

## Verification
1. Run `npm test`, `npm run typecheck` and `npm run lint`, then `npm run test:e2e`.
2. Run `wrangler deploy --dry-run` and check the size is back to about 2.5 MB gzipped.
3. After the user deploys:
   - Pages return 200.
   - `wrangler tail` shows no CPU-limit errors on the page, save and preview routes.
   - Re-scrape the deck link in the Facebook debugger: `og:image` should be `/d/…/preview?v=…`.
   - Share a plan in iMessage.

---

## Post-implementation notes

_Added 2026-09-28 by Claude (with Callum Gare), after building it, so the plan above isn't read as a description of the code. The plan itself is unchanged._

- **Step 0 wasn't done by Claude.** The rollback was blocked as a production deploy, and is left to Callum.
- **Satori is pinned at 0.25.0,** the version `next/og` bundles. 0.33 shapes text with `harfbuzzjs`, which needs Node's `fs` and won't bundle for the browser.
- **The queries are in `src/lib/previews.ts`,** not `src/lib/decks.ts`, along with `keepPreview` and `PreviewRejected`.
- **WebKit drew correctly with a canvas, so `@resvg/resvg-wasm` wasn't needed. Firefox didn't:** the first picture it drew had no card frames, because it loads pictures nested in an SVG in its own time. Now:
  - The galaxy still is drawn onto the canvas first, and the SVG over it.
  - The frames are inline SVG (`PreviewFrame`), with the frames' classes turned into attributes.
  - Every picture Satori still nests (it embeds inline SVG and emoji as pictures) is decoded before the SVG is drawn.
  - `e2e/share-preview-engines.spec.ts` checks the frames are drawn in Chromium, Firefox and WebKit.
- **Browsers blur SVG filters in linear light,** which washed out the title's halo, so the filters are set to `sRGB`.
- **An emoji that can't be fetched no longer stops the picture;** the title goes without it. Asset fetches are tried twice.
- **Pictures without cards** (the default, or a plan whose cards are gone) have the name bigger and centred.
- **A plan's name is centred above its fan** (`fanTop()`), at Callum's request.
- **Plan pages also redraw the deck's picture** for owners and editors, since cards can be edited from there. Callum asked whether card edits update the deck's picture, and that was the one place they didn't.
- **The WebKit e2e test makes its deck in Chromium,** because signing up relies on Chrome's virtual passkeys.
- **`/dev/previews` calls `connection()`,** so it isn't prerendered at build time.
