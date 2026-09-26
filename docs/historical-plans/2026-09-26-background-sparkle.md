# Background sparkle: glints, shooting stars and bursts

## Context

The drifting swirls were switched off because the look wasn't right. What was asked for instead: gold flakes that **twinkle** in place, an occasional **shooting star**, and motion that **you cause**. It also had to be efficient, reusing as much of the previous frame as possible without compromising the look.

By then the background had moved to tiles: 2D canvases 256 CSS pixels tall that scroll with the page as ordinary elements (see `2026-09-26-scrolling-background.md`). That decided most of what follows.

## Decisions

- **Sparkle as elements over the tiles, animated on the compositor.** The tiles are the previous frame, so they're kept as they are. Each glint and shooting star is a small element drawn once as CSS gradients, with only `transform` and `opacity` animated (the Web Animations API). No tile is painted again, no JavaScript runs per frame, and the sparkle scrolls with the page with no lag. A full-screen WebGL overlay was rejected: it would be redrawn every frame, and moved by JavaScript on scroll, so it would lag behind the tiles on phones.
- **Glints on real clumps, found on the GPU.** A second, tiny shader pass per tile finds the thickest gold clump in each 64 px cell. It uses the painting's own functions, so it agrees with the pixels exactly, and it reads back a few hundred bytes. The rejected options were reading the tile's pixels back (megabytes per tile) and redoing the noise in JavaScript (slow, and it could drift from the GLSL).
- **Option 2 became event bursts.** Moving the swirls on a moment that matters worked with the old full-screen texture, which could be re-sampled cheaply. With tiles it would mean repainting them (about 18 ms a screen) or going back to one full-screen canvas. Scroll-linked motion was moot, because the background already scrolls with the page, so it would have become parallax. Instead, `celebrate()` sets off a burst of the same glints and a shooting star. It's fired from `SharePlanButton` when a plan is saved, shared or has its link copied.
- **Reduced motion means none of it.** The page also rests while the tab is hidden.

## Checklist

- [x] `sitesShader` and `Painter.sites()`; `sparkle.ts` (`decodeSites`, `pickSite`, `shootingStar`, `celebrate`)
- [x] Glints, shooting stars and bursts in `GalaxyBackground`, with styles in `src/styles.css`
- [x] Bursts from `SharePlanButton`
- [x] Unit tests (sparkle logic, component, triggers) and e2e (glints land on gold, tiles untouched, burst, reduced motion)
- [x] `docs/background.md` § "Sparkle" and § "Bursts"; the `AGENTS.md` table
