# Procedural galaxy background

## Context

The site background is a photo of swirled blue paint with gold glitter (`.local/background.png`, 1080×1920; the live one is an extended 2048×2048 copy at `public/background.png`, 6.8 MB). It's shown by `body::before` in `src/styles.css:74-90` with `background-size: cover`, so on wide or tall screens it gets scaled up and the fine grain turns blurry. It's also a heavy download.

The goal is a procedurally generated version: same colours, same kind of streaky galaxy swirls made by varying the density, size and brightness of the stars. It should render sharply at any size and pixel ratio. It must also be built so the swirls can be animated later without a rewrite.

## What the image actually is (analysis)

Measured with ImageMagick (colour quantisation, masks, crops, low-pass blur):

**Four layers, back to front**

1. **Base swirl field (low frequency).** A navy field with soft ridges. Blurred down, it's long diagonal bands running bottom-left → top-right at roughly 35–45°, gently S-curved, 50–150 px wide and 400–900 px long, with a few curls near the top right. Each ridge has a lit side and a shadow trough beside it, which gives it the look of relief (it's paint). Colours:
   - trough `#05103A` (≈16 % of pixels)
   - body `#0E1A57` (≈65 %, the dominant colour; mean of the whole image is rgb(23,34,91))
   - raised/lit `#272F88` / `#384688`
   - sheen on ridge crests: a desaturated lavender `#5A5F90` / `#585B70`
2. **Blue dust (very high frequency).** Dense 1 px specks everywhere, `#303793` → `#5A6198` → `#818AB0`. Their density follows the ridges: thick on crests, sparse in troughs. Most of the "texture" comes from this layer, not from the gold.
3. **Gold flakes.** About 1.5–2.5 % of pixels. Mostly 1–4 px, a few larger clumps. Colours: core `#DBBF6F`, pale `#C7B48E`, dim `#A49C71`, with a slight pinkish edge (`#997775`) where they blend into the blue. They're **much more tightly clustered** than the dust: thin streaks sitting along the crests of *some* ridges, not all of them. Inside a streak, density, size and brightness all go up together towards its spine. This matches the existing `--accent: #e5bc81`.
4. **Sparse bright stars.** A handful of near-white pinpoints (L≈240) with a faint glow, randomly placed.

**What makes it read as a "galaxy":** the same flow field drives everything. Dust density, gold density, flake size and luminosity are all functions of one ridge value, so the streaks come from *statistics*, not from drawn shapes. That's what we reproduce.

## Approach: a single WebGL2 fragment shader

A full-screen `<canvas>` with one fragment shader that works out every pixel from its CSS-pixel coordinate. No library: a 2-triangle quad plus about 150 lines of GLSL. three.js etc. would add weight for nothing.

Alternatives considered and rejected:
- **Canvas 2D with particles**: millions of dust specks are too slow. It would only be worth it for the gold layer, which the shader handles well anyway.
- **SVG `feTurbulence`**: can't produce discrete star cells, and animating filters is expensive.
- **Pre-rendered tiles at build time**: fixes stretching but not animation, and tiles repeat visibly.

### Shader design

- **Coordinates.** Work in CSS px (`gl_FragCoord / devicePixelRatio`) so flake sizes match the photo on every screen. Rotate by about −38° and squash the along-streak axis by about 3–4×. That anisotropy is what turns isotropic noise into long diagonal bands.
- **Flow / swirl field.** Domain-warped fBm (Inigo Quilez's `fbm(p + fbm(p + fbm(p)))` pattern), 4–5 octaves of simplex or value noise. The warp creates the S-curves and curls. Everything takes a `time` input (fixed at 0 for now) so it can be animated later.
- **Ridge value `r`.** A ridged transform (`1 - abs(2n-1)`) of the warped field, sharpened with a power. It drives every layer:
  - base colour: a gradient ramp trough → body → lit → sheen, indexed by `r`
  - relief: a finite-difference derivative of `r` along a fixed light direction brightens one side of each ridge towards `#384688`/`#5A5F90` and darkens the other towards `#05103A`
- **Stars via hashed grid cells**, the standard procedural starfield technique. Split the plane into cells; each cell hashes to one candidate star with a random offset, size and brightness. The star is kept only if `hash < density(r)`. Draw it as an anti-aliased disc (`smoothstep` on distance, width from `fwidth`) and check the 3×3 neighbouring cells so larger flakes don't get clipped.
  - **Dust:** 2–3 cell layers with 3–6 px cells, radius 0.5–0.9 px, colour picked from the blue speck ramp. Density about `mix(0.15, 0.8, r)`.
  - **Gold:** 2 cell layers with 4–10 px cells. Density comes from a *second, narrower* mask: `r` gated by an independent low-frequency noise, so only some ridges carry gold, then passed through `smoothstep`. Target coverage is about 2 % of pixels. Radius and brightness are both scaled by the same mask, which gives a dense, bright spine and a sparse, dim fringe. Colour: `#A49C71 → #DBBF6F` by brightness, blended with the base at the edges.
  - **Bright stars:** 1 layer with large cells (about 120 px) and a very low keep rate, plus a small radial glow.
- **Output.** Blend in linear space and convert to sRGB at the end, so the specks don't look muddy. Add a tiny ordered or hash dither against banding in the navy gradient.
- **Seed.** A fixed seed uniform, so the background looks the same on every visit and screenshots stay stable.

### Built with animation in mind

- `time` is threaded through the warp from day one. Animating is then a `requestAnimationFrame` loop that updates one uniform.
- Stars are placed in the **warped** domain: cell lookup happens at `warp(p, t)`, not `p`. When the warp changes, the stars drift *with* the gas instead of blinking in and out as the density moves underneath fixed points. Keep the warp's spatial gradient low (amplitude × frequency ≲ 0.5) so warping the domain doesn't smear the discs.
- Choose the warp so it can be advanced continuously. For example, rotate the inner fBm's offset vector slowly, or add a curl-noise term later. Avoid anything that only looks right at t=0.
- For now: draw one frame on mount and on (debounced) resize, with no loop, so there's zero ongoing GPU cost. Later the loop goes behind `prefers-reduced-motion: no-preference` and pauses on `visibilitychange`.

## Implementation steps

1. **Prototype harness (scratch, not committed).** A standalone HTML page that shows the shader next to `.local/background.png`, with sliders for the key constants: angle, stretch, warp strength, dust and gold density, flake sizes, palette. Tune by eye and by re-running the same ImageMagick measurements on a screenshot: gold fraction ≈ 2 %, mean colour ≈ rgb(23,34,91). The measurements also make good regression targets.
2. **`src/components/galaxy/shader.ts`.** The GLSL source as a string, with the palette as named constants at the top.
3. **`src/components/galaxy/palette.ts`.** The measured colours as sRGB hex plus a hex → linear-RGB helper, so the shader and CSS share one source of truth.
4. **`src/components/GalaxyBackground.tsx`** (`'use client'`). `<canvas aria-hidden>` with `position: fixed; inset: 0; z-index: -1; pointer-events: none`, sized to the large viewport just as `body::before` is now (keep the iOS reasoning from that comment). It sets up WebGL2 (falling back to WebGL1 if needed), caps DPR at 2, redraws on debounced `resize`, and handles `webglcontextlost`/`restored`. If there's no WebGL it renders nothing, and the CSS fallback shows through.
5. **`src/app/layout.tsx`.** Render `<GalaxyBackground />` inside `<body>` before `.app-root`.
6. **`src/styles.css`.** Change `body::before` to a cheap CSS fallback (a navy radial/linear gradient using the palette) instead of `url('/background.png')`, and fade the canvas in once its first frame is drawn to avoid a flash. Once it's signed off, delete `public/background.png` (6.8 MB).
7. **Docs.** Add `docs/background.md`: the layers, the palette with where each colour came from, the density-drives-everything idea, the tuning constants, and the animation contract (stars live in the warped domain; `time` uniform). Add its row to the `AGENTS.md` docs table, and save this plan as `docs/historical-plans/2026-09-26-procedural-background.md`.

## Tests

- `src/components/GalaxyBackground.test.tsx`: jsdom has no WebGL, so stub `getContext`.
  - renders an `aria-hidden` canvas
  - renders nothing / doesn't throw when `getContext` returns `null`
  - redraws on resize and cleans up listeners on unmount
- `src/components/galaxy/palette.test.ts`: the hex → linear conversion, and that the palette matches the `--accent` gold.
- `e2e/background.spec.ts`: Playwright uses real WebGL. Load `/`, wait for the canvas's ready flag, and check the canvas is visible and non-blank by reading a few pixels back with `preserveDrawingBuffer` or `toDataURL`. Also do a coarse screenshot comparison at 2 viewport sizes (phone portrait and wide desktop) to show it doesn't stretch.
- Tests cite `docs/background.md` sections for the documented requirements (fallback, fixed seed, no stretch).

## Verification

- `npm run dev`, then look at phone, laptop and ultrawide sizes and at DPR 1 and 2. The grain should stay crisp and the streak direction and colour should match the photo.
- Screenshot the canvas and re-run the measurement script: mean colour and gold fraction within tolerance of the photo.
- `npm run test`, `npm run test:e2e`, `npm run typecheck`, `npm run lint`.
- In the Performance panel, check the first frame renders in under about 20 ms on a laptop and that there's no ongoing GPU work while idle.
