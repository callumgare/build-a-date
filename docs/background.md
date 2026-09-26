# The background

Behind every page is a field of swirling dark blue, dusted with pale blue specks and streaked with gold, where gold flakes glint now and then and a shooting star falls once in a while. It used to be a photo of paint and glitter (`public/background.png`), stretched with `background-size: cover`. Stretched over a wide or tall screen, the grain went soft and blurry, and the file was 6.8 MB. Now it's drawn by a WebGL shader that recreates the photo's look at whatever size the screen is, and it scrolls with the page like an ordinary background.

- `src/components/GalaxyBackground.tsx`: the layer behind the page and its tiles, mounted once in `src/app/layout.tsx`
- `src/components/galaxy/tiles.ts`: which tiles to paint and which to let go
- `src/components/galaxy/render.ts`: sets up WebGL and paints a tile
- `src/components/galaxy/shader.ts`: the GLSL that works out every pixel
- `src/components/galaxy/palette.ts`: the colours
- `src/components/galaxy/sparkle.ts`: where glints and shooting stars go, and `celebrate()`

## How it's drawn

Every pixel is worked out from nothing but where it is on the page, measured from the page's top left. So it can be painted in pieces that meet without seams, and a wider or longer page just has more of the same field on the right and at the bottom.

There are four layers, back to front, just as in the photo:

1. **The swirls.** Parallel bands, 38° above level, running from bottom left to top right. Domain-warped noise bends them into S-curves and occasional curls, and a second noise makes them come and go along their length. That gives each point a *height*: 0 in a trough, 1 on the crest of a ridge. The colour follows the height (trough → body → lit → raised). A relief term gives the side of each ridge facing the top-left light a lavender sheen and drops the far side into shadow. Under the specks, each CSS pixel gets a random mottle of lighter and darker blue.
2. **Blue dust.** Two layers of tiny specks, thick on the ridges and sparse in the troughs.
3. **Gold.** Flakes and larger clumps, only along the spines of *some* bands (a third, slow noise picks which). Towards a vein's spine, the flakes get more common, bigger and brighter together, so each vein has a dense bright core and a sparse dim fringe.
4. **Bright stars.** A few near-white points with a faint glow.

The streaks aren't drawn as shapes. They come from the *statistics*: how often a speck appears, how big it is and how bright it is are all driven by the same height and gold values. Specks come from a grid. Each cell holds at most one, with a random position, size and brightness, and it's kept or dropped according to the density at that spot.

The shapes are tuned with the constants at the top of `fragmentShader` (`STREAK_LENGTH`, `STREAK_WIDTH`, `BAND_SPACING`, `BEND`, `WARP`, `LIGHT`) and the densities in its `main()`. At 1080×1920 (a feature scale of 0.85) the finished picture compares with the photo like this; the gold is deliberately calmer than the photo's:

| | photo | shader |
| --- | --- | --- |
| mean colour | rgb(22, 33, 91) | rgb(26, 35, 92) |
| gold pixels | 2.5 % | 1.0 % |

### How big it's drawn

The shader's sizes are in pixels of the photo. `featureScale()` in `render.ts` turns them into CSS pixels, so it depends on the size of the **screen**, from 0.45 on a phone up to 0.85 on a large monitor. The photo was shrunk to cover the screen, which made its grain finer on a phone (about 0.4×) than on a laptop (about 0.75×), and this keeps that feel. It goes by the screen rather than the window so that resizing a window never rescales the picture.

## The palette

The colours in `palette.ts` were measured from the photo:

- **Ground:** trough `#05103a`, body `#0e1a57` (about two thirds of the picture), lit `#272f88`, raised `#384688`
- **Sheen:** `#5a5f90`
- **Mottle:** `#1f288c`
- **Dust:** `#303793` → `#5a6198` → `#818ab0`
- **Gold:** flake centres `#debd63` and `#e0c492`, fringe `#a49c71`

The shader blends in linear light. `glslPalette()` turns the hex values into GLSL constants, so `palette.ts` is the only place a colour is defined.

## The same every time

The picture comes from a fixed seed (`DEFAULT_SEED` in `render.ts`), so it looks the same on every visit and every reload. Change the seed to get a different field with the same character.

## Tiles

The page can be many screens tall, far too much to paint up front, so the picture is painted in **tiles**. Each tile is a 2D canvas `TILE_HEIGHT` (256) CSS pixels tall, placed at its spot down the page in the `.galaxy-background` layer. The layer sits behind the page, is as tall as `<body>`, and clips the tiles so they never make the page longer or wider. Because the tiles are ordinary elements in the page, the browser scrolls them with everything else, with no lag.

`tilePlan()` in `tiles.ts` decides which tiles there should be:

- **Tiles the window shows** are painted straight away.
- **Tiles within a screen's height** above and below the window are painted ahead of time, nearest first, one per animation frame. Scrolling normally finds them already there.
- **Tiles more than three screens away** are removed, to keep memory in check. Scrolling back paints them again, identical.

One WebGL context paints every tile. It's an offscreen canvas that runs the shader for a tile's place on the page and copies the result into the tile (`createPainter()` in `render.ts`). If the browser drops the GPU context, the tiles already painted stay, since they're 2D canvases. Painting tries again every second until the context is back.

Each tile fades in as it's added, with no fade under `prefers-reduced-motion`. On a 1440×900 window at 2× sharpness on an M1 Max, jumping 4000 px down the page repaints the window in one frame of about 18 ms.

## Overdrawn

The tiles are as wide as the whole **screen**, not just the window, and have a fixed size in CSS pixels. Making the window wider just shows more of what's already painted: it's never stretched, and nothing is painted again. `overdrawSize()` in `render.ts` works out how much to cover:

- **On a computer:** the screen.
- **On a phone or tablet** (`pointer: coarse`): the screen's longer side both ways, so turning it is covered too.
- **Either way:** the window as well, if it's bigger than the screen (zoomed out, or moved to a bigger display).

A taller window is covered the same way, because tiles within a screen's height of the window are already painted.

Every tile is painted again only if the window gets wider than the tiles, or the sharpness changes (browser zoom, or moving to a display with a different pixel ratio or size), since then every pixel changes. The width is rounded up in steps of 128 CSS pixels (`WIDTH_STEP`), so dragging a window past the screen doesn't repaint on every step.

## Sparkle

The painting itself never moves. What moves is a little **sparkle** over it: gold flakes that glint now and then, and a shooting star once in a while. (The swirls themselves used to drift, but the look wasn't right.)

**Nothing is painted again to sparkle.** Each glint and shooting star is a small element in the `.galaxy-background` layer, above the tiles. It's drawn once as CSS gradients (`.galaxy-glint`, `.galaxy-shooting-star` in `src/styles.css`), and only its `transform` and `opacity` are animated, with the Web Animations API. The browser's compositor moves pixels it has already drawn, so a frame costs no JavaScript and no painting, and the sparkle scrolls with the page as smoothly as the tiles do. When an animation ends, its element is removed.

- **Glints** land on real gold clumps. When a tile is painted, a second, tiny shader pass (`sitesShader`, `Painter.sites()`) finds the thickest gold clump in each `SITE_SIZE` (64 CSS pixels) cell of the tile. It uses the same `swirl()` and the same grid of clumps as the painting, so it finds exactly the clumps that were painted. It reads back 4 bytes a cell, a few hundred bytes a tile, which `decodeSites()` turns into places on the page. It costs about 0.9 ms a tile, against about 12.6 ms to paint the tile (M1 Max). A tile's sites are let go along with the tile. Every 350–950 ms, `pickSite()` picks a site the window shows, favouring the thick of a vein, and it glints: a bright core with a four-point flare, which grows, turns a little and fades over 1.4–2.4 s. At most `MAX_GLINTS` (6) glint at once, never the same clump twice. Clumps behind a card can glint unseen; nothing checks what's on top.
- **Shooting stars** fall every 18–45 s. Each starts in the top two thirds of the window, towards the right, and falls down and to the left along the streaks (`SHOOTING_STAR_ANGLE`, 142°), with a tail that fades back from a bright head.

It all rests while the tab is hidden. Under `prefers-reduced-motion: reduce` there's none of it, bursts included, and turning reduced motion on mid-visit stops it.

### Bursts

For a moment that matters, `celebrate()` in `sparkle.ts` sets off a **burst**: `BURST_GLINTS` (16) glints over 1.2 s, past the usual limit, and a shooting star. It works by an event on the window (`galaxy:celebrate`), so a page can call it without knowing about the background. `SharePlanButton` calls it when a plan has just been saved (the share dialog opening by itself), when the plan is shared from the share sheet, and when its link is copied. A share sheet closed without sharing doesn't count.

## Fallback

Where WebGL 2 isn't available, and anywhere a tile isn't painted yet, the layer's own colour shows: the palette's body blue, `#0e1a57`.

The pixel ratio is capped at 2.
