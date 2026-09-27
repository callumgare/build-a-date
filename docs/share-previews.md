# Link previews

When a link to a shared deck (`/d/…`), a plan (`/p/…`) or the sample deck (`/sample`) is pasted into a messaging app, the app shows a picture with it. The picture has the deck's name at the top, in the site's heading gold (`--accent`, `#e5bc81`) with its dark halo (`--background-text-shadow`), over the galaxy background, and the cards below it.

- `src/app/(public)/d/[shareId]/opengraph-image.tsx`, `src/app/(public)/p/[planId]/opengraph-image.tsx` and `src/app/(public)/sample/opengraph-image.tsx`: the images, using Next's `opengraph-image` file convention
- `src/lib/og/render.tsx`: `renderShareImage()`, which draws the picture with `next/og`'s `ImageResponse` (Satori, then resvg)
- `src/lib/og/layout.ts`: where the cards go (`deckGrid`, `planFan`)
- `src/lib/og/card.tsx`: a card as the picture draws it (`PreviewCard`)
- `src/lib/og/assets.ts`: loads the fonts and background (`loadAsset`)
- `src/lib/og/metadata.ts`: the pages' preview metadata (`shareMetadata`)

Every picture is 1200×630, the size most apps expect, and a PNG. `next/og` adds its wasm (resvg and yoga) to the Worker, about 0.6 MB gzipped. Each one is drawn when it's asked for, and it's sent with `Cache-Control: public, max-age=3600`. Anyone with the link can already see the deck and its cards (docs/deck-sharing.md), so the picture shows nothing the link doesn't.

## A deck

The deck's name, then its cards in rows of 5, centred, as on the deck page. The second row runs off the bottom of the picture, so a big deck looks like it carries on. Rows that would start below the picture aren't drawn at all, so at most 10 cards are drawn. A deck of 5 or fewer cards is a single row, centred.

The cards are in the deck's own order, not shuffled as on the page, so the picture is the same every time it's fetched. The sample deck gets the same kind of picture from its own cards. It's drawn when it's asked for too (`dynamic = 'force-dynamic'`), not at build time, because at build time there's no Cloudflare context to load the fonts from.

## A plan

The deck's name, then the plan's picks fanned out like a hand of cards. The picks are every card in the plan in order: the first row, then each group's.

The cards sit on an arc around a point far below the picture. Each one is turned about its own centre by its angle on the arc, so the hand spreads from the middle, and the outer cards dip off the bottom. The first pick is on the left, at the back, and each card after it overlaps the one before.

- The angle between neighbouring cards is at most 16°, so a small hand spreads out enough for every title to show.
- The whole hand spans at most 72°, so a big hand closes up.
- At most 9 cards are drawn, the first 9 picks.

A plan whose cards have all since been removed from the deck shows just the name.

## The cards

A card in the picture is the deck page's card (`src/components/Card.tsx`) at a fixed size: the same paper, border and frame, which `frameFor()` picks from the card's id, so a card has the same frame here as on the page. It shows the title and the date, if the card has one, but not the description, which would be too small to read.

Satori can't measure text the way `useFitText` does on the page, so a title's size steps down with its length (`titleScale()`), and a title never runs past 4 lines.

The frame is drawn as one SVG, sized to the card (`frameSvg()`), laid out as `FrameArt` lays out its pieces with CSS: the top piece, rails stretched down to the bottom piece, and the bottom piece. Its strokes are 1px wide, as `vector-effect: non-scaling-stroke` makes them on the page.

## The background

The page's background is a WebGL shader (docs/background.md), and that only runs in a browser. So the picture uses a still of it instead: `public/og/background.jpg`, 1200×630. The shader's seed is fixed, so the still is exactly what the site shows.

`npm run og:background` takes the still again. Run it with the dev server running (`npm run dev`), and pass the dev server's address if it isn't `http://localhost:3000`. It hides everything on the home page but the background, and turns off the sparkle. The still is **zoomed in**: a preview is usually shown at a third of its size or less, which would make the swirls look far finer than on the site. So it's taken in a 600×315 window at 2× (the most the background paints at), on a big screen so the swirls are drawn their biggest (`featureScale()` in docs/background.md § "How big it's drawn"), about 2.6 times as big as at 1200×630 on a laptop. Take it again whenever the shader or its palette changes.

## Fonts and assets

Satori has no fonts of its own, so each picture loads its fonts:

- **Tan Pearl** (`public/tan-pearl.otf`), for the deck's name and the cards' titles, as on the page
- **Lora SemiBold** (`public/og/lora-semibold.ttf`, SIL Open Font License), for the cards' dates. The page uses Georgia for those, which can't be bundled.

Emoji come from Twemoji, which Satori fetches only when a title has one.

`loadAsset()` loads the fonts and the background from the Worker's static assets (the `ASSETS` binding) and keeps them for the life of the Worker. Under `next dev`, `ASSETS` serves the last OpenNext build, which may be missing the files or have old copies of them, so there they're always fetched from the site (`BETTER_AUTH_URL`), which serves `public/` as it is now. Anywhere else, a file `ASSETS` doesn't have is fetched from the site too. In tests, the `ASSETS` stand-in in `src/test/cloudflare.ts` reads from `public/`.

## The page's metadata

`shareMetadata()` gives each of the three pages its title and description for the preview (`og:*` and `twitter:*`), and asks for a large picture (`summary_large_image`). Next adds the image from the page's `opengraph-image` file, for both. Messaging apps need the image's address to be absolute, so `metadataBase` is the site's own address, `BETTER_AUTH_URL`.

Only the pages people share get a picture. The edit pages (`/p/…/edit`, `/decks/…`) are only for the people who can edit, so they have none.
