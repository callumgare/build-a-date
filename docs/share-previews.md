# Link previews

When a link to a shared deck (`/d/…`), a plan (`/p/…`) or the sample deck (`/sample`) is pasted into a messaging app, the app shows a picture with it. The picture has the deck's name at the top, in the site's heading gold (`--accent`, `#e5bc81`) with its dark halo (`--background-text-shadow`), over the galaxy background, and the cards below it. Every picture is a 1200×630 JPEG, the size most apps expect.

**The browser draws the pictures, not the server.** On Cloudflare's free plan a request gets 10 ms of CPU, far too little to draw a picture, and the libraries that draw them made the Worker too big to start in time. (The first version drew them in the Worker with `next/og`, and took the whole site down: docs/historical-plans/2026-09-28-share-previews.md.) So a browser draws each picture and sends it, and the Worker only checks it, keeps it in D1 and hands it out.

- `src/lib/og/preview.tsx`: the picture as a tree for Satori (`PreviewImage`), and which cards make it in (`drawnCards`)
- `src/lib/og/layout.ts`: where the cards go (`deckGrid`, `planFan`)
- `src/lib/og/card.tsx`: a card as the picture draws it (`PreviewCard`, `PreviewFrame`)
- `src/lib/og/draw.tsx`: draws a picture in the browser (`drawSharePreview`)
- `src/lib/og/client.ts`: `drawPreview` (draws, with a time limit) and `preloadPreview`
- `src/lib/og/preview-key.ts`: `previewKey`, what a picture shows
- `src/lib/og/jpeg.ts`: `checkPreviewImage`, the checks on a picture sent in
- `src/lib/previews.ts`: keeping and reading pictures (`keepPreview`, `getPreviewKey`, `getPreviewImage`)
- `src/components/SharePreviewRefresher.tsx`: redraws a picture that's out of date
- `src/lib/og/serve.ts` and the `preview/route.ts` under `/d/[shareId]` and `/p/[planId]`: hand them out
- `src/lib/og/metadata.ts`: the pages' preview metadata (`shareMetadata`)

Anyone with a deck or plan's link can already see its cards (docs/deck-sharing.md), so the picture shows nothing the link doesn't.

## A deck

The deck's name, then its cards in rows of 5, centred, as on the deck page. The second row runs off the bottom of the picture, so a big deck looks like it carries on. Rows that would start below the picture aren't drawn at all, so at most 10 cards are drawn. A deck of 5 or fewer cards is a single row, centred.

The cards are in the deck's own order, not shuffled as on the page, so the picture only changes when the deck does.

## A plan

The deck's name, then the plan's picks fanned out like a hand of cards. The picks are every card in the plan in order: the first row, then each group's.

The cards sit on an arc around a point far below the picture. Each one is turned about its own centre by its angle on the arc, so the hand spreads from the middle, and the outer cards dip off the bottom. The first pick is on the left, at the back, and each card after it overlaps the one before.

- The angle between neighbouring cards is at most 16°, so a small hand spreads out enough for every title to show.
- The whole hand spans at most 72°, so a big hand closes up.
- At most 9 cards are drawn, the first 9 picks.

The name is centred, roughly, in the space above the hand: between the top of the picture and the highest corner of any card (`fanTop()`).

With no cards (a plan whose cards have all since been removed from the deck, or the default picture), the name is drawn bigger, in the middle of the picture.

## The cards

A card in the picture is the deck page's card (`src/components/Card.tsx`) at a fixed size: the same paper, border and frame, which `frameFor()` picks from the card's id, so a card has the same frame here as on the page. It shows the title and the date, if the card has one, but not the description, which would be too small to read.

Satori can't measure text the way `useFitText` does on the page, so a title's size steps down with its length (`titleScale()`), and a title never runs past 4 lines.

The frame is drawn inline as SVG, sized to the card (`PreviewFrame`), laid out as `FrameArt` lays out its pieces with CSS: the top piece, rails stretched down to the bottom piece, and the bottom piece. Its strokes are 1px wide, as `vector-effect: non-scaling-stroke` makes them on the page. Satori keeps no stylesheet, so the frames' `fill` and `faint` classes become SVG attributes.

## Drawing in the browser

`drawSharePreview()` has Satori lay the picture out as an SVG, with the fonts below, and then draws it onto a canvas and saves that as a JPEG (quality 0.85, 150–350 KB). It's only loaded with `import()` when a picture is wanted, so it adds nothing to the pages themselves. Turbopack still puts a copy in the Worker's bundle, from rendering the client components on the server, about 170 KB gzipped that never runs. Neither a `typeof window` guard nor a `browser`-only package import kept it out. With it, the Worker is about 2.7 MB gzipped, under the free plan's 3 MB.

Browsers differ in how they draw an SVG onto a canvas, and each is covered by `e2e/share-preview-engines.spec.ts`:

- **Firefox** loads pictures inside an SVG in its own time, and drawing the SVG doesn't wait for them, so the first picture it drew came out without its cards' frames. So the galaxy still is drawn onto the canvas first, with the SVG over it, and every picture left inside the SVG (Satori embeds the frames and emoji as pictures of their own) is decoded before the SVG is drawn.
- **All of them** blur SVG filters in linear light unless told otherwise, which washes the title's halo out. CSS blurs text-shadow in sRGB, so the filters are set to `color-interpolation-filters="sRGB"`.

Satori is pinned at 0.25.0, the version `next/og` uses. Later ones shape text with `harfbuzzjs`, which needs Node's `fs` and won't bundle for the browser.

### Fonts

Satori has no fonts of its own, so the browser fetches them, once a visit, with the galaxy still:

- **Tan Pearl** (`public/tan-pearl.otf`), for the deck's name and the cards' titles, as on the page
- **Lora SemiBold** (`public/og/lora-semibold.ttf`, SIL Open Font License), for the cards' dates. The page uses Georgia for those, which can't be bundled.

Emoji in a title come from Twemoji on cdn.jsdelivr.net, only when a title has one. If it can't be fetched, the title goes without it.

## When it's drawn

`previewKey()` says what a picture shows: a hash of the deck's name, the layout, and the id, title and date of each card that's drawn. The server works it out from the database, and the browser from what it drew. A picture is only kept if the two agree. Cards off the edge of the picture don't count, so adding an 11th card to a deck doesn't redraw it, and nor does changing a card's rating or notes, which the picture doesn't show. `DRAWING_VERSION` is part of the key: bump it whenever the picture is drawn differently, and every picture is drawn again as its page is next opened.

A picture is drawn:

- **When a plan is saved** (Save plan or Update Plan). `PlanBuilder` draws it from the picks and sends it with the save, so it's there by the time the share dialog opens. It starts loading what drawing needs as soon as there's a pick. If the picture can't be drawn within 3 s, or isn't kept, the plan saves without it.
- **When a page finds its picture out of date, or missing.** `SharePreviewRefresher` compares the key of what the page shows with the key of the picture kept, and if they differ it draws and sends a new one, 2 s after the page settles, so a run of quick edits draws once. Card and deck actions refresh the page they're on, so an edit is followed by a new picture. It's on:
  - the deck's edit page (`/decks/…`), where owners share the deck's link and edit it
  - the shared deck (`/d/…`), for owners and editors
  - a plan's page (`/p/…`), for anyone, and for owners and editors the deck's picture too, since cards can be edited from there

Until a picture is drawn, a deck or plan's link shows the default picture. After a change, it shows the old picture until one of those pages is next opened.

## Who can upload a picture

The same people who can change what it shows:

- **A deck's:** its owner and editors (`saveDeckPreview`, which goes through `getEditableDeck`). Someone who can only view a deck can't set its picture, just as they can't edit it.
- **A plan's:** anyone with its link (`savePlanPreview`, and with `savePlan`/`updatePlan`), as anyone with the link can edit it (docs/plans.md § "Who can edit a plan").

`keepPreview()` only keeps a picture if its key is what the deck or plan shows now, and it's a 1200×630 JPEG of at most 1 MB (`checkPreviewImage()` reads the size from the JPEG's start-of-frame marker). Anything else is turned away, and nothing is kept.

## Storing and serving

Pictures are kept in D1, in `deck_preview` and `plan_preview`: one row per deck or plan, with the picture's key and the JPEG. They're kept apart from the `deck` and `plan` rows so ordinary queries don't load them, and go when their deck or plan is deleted.

`/d/<shareId>/preview` and `/p/<planId>/preview` hand the kept picture out as `image/jpeg`, and 404 if there's none. Pages link to it with `?v=<key>`, so an address always means the same picture: with the key of the picture kept, it's cached for a year (`immutable`). Any other address might mean an older picture, so it's only cached for 5 minutes. A new picture gets a new address, so messaging apps fetch it again.

## The page's metadata

`shareMetadata()` gives each of the three pages its title and description for the preview (`og:*` and `twitter:*`), its own address and its picture's, and asks for a large picture (`summary_large_image`). Messaging apps need the addresses to be absolute, so `metadataBase` is the site's own address, `BETTER_AUTH_URL`.

Facebook's link debugger asks for two more properties. `og:url` is the page's own address, which each page hands `shareMetadata()`. `fb:app_id` is the app the domain belongs to; an app has to be made at [developers.facebook.com](https://developers.facebook.com/apps) first, so the tag is only given when `FACEBOOK_APP_ID` is set (`wrangler secret put` for production, `.dev.vars` locally, and a stand-in id in `.dev.vars.e2e` for the tests). Without one Facebook still shows the preview, but reports the property missing.

- **A deck or plan with a picture:** `/d/<shareId>/preview?v=<key>` or `/p/<planId>/preview?v=<key>`, the picture kept even if it's out of date, until a new one arrives
- **A deck or plan without one yet:** `/og/default.jpg`
- **The sample deck:** `/og/sample.jpg`

Only the pages people share get a picture. The edit pages (`/p/…/edit`, `/decks/…`) are only for the people who can edit, so they have none.

## The static pictures

`public/og/` holds what's drawn once rather than per deck:

- `background.jpg`: the galaxy still every picture is drawn over
- `sample.jpg`: the sample deck's picture
- `default.jpg`: "Build-a-Date" on its own, for a deck or plan whose picture hasn't been drawn yet

`npm run og:images` makes all three again. Run it with the dev server running (`npm run dev`), and pass the dev server's address if it isn't `http://localhost:3000`. Run it whenever the shader, its palette or the drawing changes.

### The background

The page's background is a WebGL shader (docs/background.md). The script takes a still of it: it hides everything on the home page but the background, and turns off the sparkle. The shader's seed is fixed, so the still is exactly what the site shows. The still is **zoomed in**: a preview is usually shown at a third of its size or less, which would make the swirls look far finer than on the site. So it's taken in a 600×315 window at 2× (the most the background paints at), on a big screen so the swirls are drawn their biggest (`featureScale()` in docs/background.md § "How big it's drawn"), about 2.6 times as big as at 1200×630 on a laptop.

### The sample and default pictures

`/dev/previews` draws them in the browser, the way every other picture is drawn, and the script saves them. The page also draws a few fans to look at. It's only there when the site's address (`BETTER_AUTH_URL`) is localhost, like the dev outbox.
