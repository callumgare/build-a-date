import { SITE_SLACK } from './shader'

/**
 * The grid the gold sites are found on, in CSS pixels: one clump that can
 * glint per cell, at most (docs/background.md § "Sparkle").
 */
export const SITE_SIZE = 64

/** Sites closer than this, in CSS pixels, are the same clump found twice. */
const SAME_CLUMP = 3

/** A gold clump in the painting that can glint, in CSS pixels on the page. */
export type Site = {
  x: number
  y: number
  /** How thick the gold is there, from just above 0 to 1. */
  gold: number
  radius: number
}

/**
 * Turns what the sites pass read back (see `sitesShader`) into sites on the
 * page, for a tile at `top` CSS pixels down it. Cells with no clump are left
 * out.
 */
export function decodeSites(bytes: Uint8Array, columns: number, rows: number, top: number, scale: number): Site[] {
  const cell = SITE_SIZE / scale
  const span = cell + 2 * SITE_SLACK
  const sites: Site[] = []
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const i = (row * columns + column) * 4
      if (!bytes[i + 2]) continue
      const x = column * SITE_SIZE + ((bytes[i] / 255) * span - SITE_SLACK) * scale
      const y = top + row * SITE_SIZE + ((bytes[i + 1] / 255) * span - SITE_SLACK) * scale
      // Cells next to each other can find the same clump across their edge.
      if (sites.some((site) => Math.abs(site.x - x) < SAME_CLUMP && Math.abs(site.y - y) < SAME_CLUMP)) continue
      sites.push({ x, y, gold: bytes[i + 2] / 255, radius: (bytes[i + 3] / 255) * 4 * scale })
    }
  }
  return sites
}

/** The part of the page the window shows, in CSS pixels. */
export type View = { top: number; width: number; height: number }

/**
 * A site the window shows, picked at random but favouring the thick of a
 * vein, where the gold is densest, or null if the window shows none. Sites
 * in `busy` (glinting already) are left out.
 */
export function pickSite(
  sites: Iterable<Site>,
  view: View,
  random: () => number,
  busy: ReadonlySet<Site> = new Set(),
): Site | null {
  const shown: Site[] = []
  let total = 0
  for (const site of sites) {
    if (busy.has(site)) continue
    if (site.x < 0 || site.x > view.width || site.y < view.top || site.y > view.top + view.height) continue
    shown.push(site)
    total += site.gold * site.gold
  }
  let left = random() * total
  for (const site of shown) {
    left -= site.gold * site.gold
    if (left <= 0) return site
  }
  return shown.at(-1) ?? null
}

/**
 * The direction a shooting star falls: down and to the left, along the
 * streaks (which rise 38° from bottom left to top right), in degrees
 * clockwise from pointing right.
 */
export const SHOOTING_STAR_ANGLE = 142

export type ShootingStar = {
  /** Where its head starts, in CSS pixels on the page. */
  x: number
  y: number
  angle: number
  /** How long its tail is, and how far it goes, in CSS pixels. */
  length: number
  distance: number
  duration: number
}

/**
 * A shooting star in the window: it starts in the top two thirds, towards
 * the right, and falls along the streaks.
 */
export function shootingStar(view: View, random: () => number): ShootingStar {
  return {
    x: view.width * (0.35 + 0.65 * random()),
    y: view.top + view.height * (0.05 + 0.6 * random()),
    angle: SHOOTING_STAR_ANGLE + (random() - 0.5) * 16,
    length: 120 + 100 * random(),
    distance: 320 + 260 * random(),
    duration: 850 + 450 * random(),
  }
}

/** A random wait between `from` and `to` milliseconds. */
export function between(from: number, to: number, random: () => number) {
  return from + (to - from) * random()
}

/** The event that sets off a burst of sparkle behind the page. */
export const CELEBRATE_EVENT = 'galaxy:celebrate'

/**
 * Sets off a flurry of glints and a shooting star behind the page, for a
 * moment that matters (docs/background.md § "Bursts").
 */
export function celebrate() {
  window.dispatchEvent(new Event(CELEBRATE_EVENT))
}
