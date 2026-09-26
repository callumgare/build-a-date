# Scrolling background

## Context

The galaxy background (docs/background.md) was a fixed layer: one canvas the size of the screen, sitting still while the page scrolled over it. The picture now needs to scroll with the page, like an ordinary background.

A page can be many screens tall, so the whole page can't be painted up front. At 2× sharpness that would be hundreds of MB, and it would go past the canvas size limits on phones. The disabled drift animation relied on one cached copy of the visible picture, which doesn't fit a scrolling design. It's being removed (decided with the user).

## Approach: tiles down the page

- A wrapper `div` (`.galaxy-background`) sits behind the page: absolutely positioned at the top left, as tall as `<body>` (kept in step with a `ResizeObserver`) and clipped with `overflow: hidden`. Its colour is the palette's body blue, which is the fallback.
- Inside it, the picture is a column of **tiles**: 2D canvases `TILE_HEIGHT` (256) CSS pixels tall, at `top = index × TILE_HEIGHT`. Because they're ordinary elements in the page, the browser scrolls them natively, with no lag.
- Each tile is as wide as `overdrawSize()` (the screen, or the longer side both ways on touch screens). Widening the window never stretches anything or repaints.
- **One WebGL context** paints them: an offscreen canvas the size of a tile runs the single-pass shader for that tile's position, then `drawImage` copies it into the tile. Every pixel depends only on its position in the page, so the tiles meet without seams.
- **Which tiles are drawn** (`src/components/galaxy/tiles.ts`, pure):
  - tiles overlapping the viewport are painted straight away;
  - tiles within one viewport above and below are painted ahead of time, nearest first, one per animation frame;
  - tiles more than three viewports away are removed, to keep memory in check.
- A change of sharpness (zoom, or moving to another display) or of tile width drops every tile and paints again.
- A lost WebGL context doesn't blank the page, since the painted tiles are 2D canvases. Painting waits for the context to be restored.

## Removing drift

Remove the `drift` prop, `flow()`, the display pass, the Catmull-Rom sampling, `DRIFT_MARGIN`, `pictureSize`/`newRegions`/`cover`, and their tests. Remove the Animation section from the docs.

## Files

- `src/components/galaxy/shader.ts`: back to one fragment shader, positioned by `uOrigin`
- `src/components/galaxy/render.ts`: `createPainter()` replaces `createGalaxy()`; keeps `featureScale`, `overdrawSize`
- `src/components/galaxy/tiles.ts` (new): `tilePlan()`
- `src/components/GalaxyBackground.tsx`: the wrapper and the tiles
- `src/styles.css`: the wrapper replaces the fixed layers; `body::before` goes
- `docs/background.md`, the `AGENTS.md` row

## Tests

- `tiles.test.ts`: visible tiles, tiles painted ahead (nearest first), removal, clamping to the page
- `GalaxyBackground.test.tsx` (with the painter mocked):
  - paints visible tiles on mount, then the rest one per frame
  - scrolling paints newly visible tiles and removes far ones
  - widening within the screen repaints nothing; widening past it repaints
  - no WebGL leaves the fallback colour
  - a failed paint is retried
- `e2e/background.spec.ts`:
  - the background scrolls with the content
  - tiles are pixel for pixel
  - it doesn't make the page longer or scroll sideways
  - growing the window within the screen keeps the same tiles
  - the colours are right
  - it's the same on every visit
