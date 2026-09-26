'use client'

import { useEffect, useRef } from 'react'
import { createPainter, featureScale, MAX_PIXEL_RATIO, overdrawSize } from './galaxy/render'
import { between, CELEBRATE_EVENT, pickSite, type Site, shootingStar, type View } from './galaxy/sparkle'
import { TILE_HEIGHT, tilePlan } from './galaxy/tiles'

/** The tiles' width is rounded up to this, so a drag past the screen grows it in steps. */
const WIDTH_STEP = 128

/** How long to wait before trying again when the GPU context has been lost. */
const RETRY_DELAY = 1000

/** How often a flake glints, in milliseconds (docs/background.md § "Sparkle"). */
const GLINT_EVERY = [350, 950] as const
/** How often a shooting star falls, in milliseconds. */
const SHOOTING_STAR_EVERY = [18_000, 45_000] as const
/** Most glints at once, outside a burst. */
const MAX_GLINTS = 6
/** A burst's glints, and how long it takes to set them all off, in milliseconds. */
const BURST_GLINTS = 16
const BURST_LENGTH = 1200

/**
 * The swirling blue and gold behind every page. It scrolls with the page,
 * painted in tiles near what's on screen and let go further away
 * (docs/background.md). Where it can't be drawn, the layer's own colour
 * shows through. Unless reduced motion is asked for, gold flakes glint now
 * and then, a shooting star falls once in a while, and `celebrate()` sets off
 * a burst of both. None of it paints the tiles again.
 */
export default function GalaxyBackground() {
  const layerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const layer = layerRef.current
    if (!layer) return
    const painter = createPainter()
    if (!painter) return

    const tiles = new Map<number, HTMLCanvasElement>()
    // The gold clumps each tile has that can glint, in CSS pixels on the page.
    const sites = new Map<number, Site[]>()
    // What the tiles are painted for: their width in CSS pixels, and how sharp.
    let painted = { width: 0, ratio: 0, scale: 0 }
    let frame = 0
    let retry: ReturnType<typeof setTimeout> | undefined

    const paintTile = (index: number) => {
      if (tiles.has(index)) return true
      const tile = document.createElement('canvas')
      tile.width = Math.round(painted.width * painted.ratio)
      tile.height = Math.round(TILE_HEIGHT * painted.ratio)
      tile.style.top = `${index * TILE_HEIGHT}px`
      tile.style.width = `${painted.width}px`
      tile.style.height = `${TILE_HEIGHT}px`
      if (!painter.paint(tile, index * TILE_HEIGHT, painted.ratio, painted.scale)) return false
      tiles.set(index, tile)
      layer.appendChild(tile)
      const found = painter.sites(index * TILE_HEIGHT, painted.width, painted.scale)
      if (found) sites.set(index, found)
      return true
    }

    const clear = () => {
      for (const tile of tiles.values()) tile.remove()
      tiles.clear()
      sites.clear()
    }

    const tryLater = () => {
      clearTimeout(retry)
      retry = setTimeout(schedule, RETRY_DELAY)
    }

    // Works out what's needed, paints what the window shows now, and one tile
    // ahead of it per frame until the window's surroundings are painted.
    const tick = () => {
      frame = 0
      const turns = window.matchMedia('(pointer: coarse)').matches
      const viewport = { width: window.innerWidth, height: window.innerHeight }
      const overdraw = overdrawSize(window.screen, viewport, turns)
      const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO)
      const scale = featureScale(window.screen.width, window.screen.height)
      const width = Math.ceil(overdraw.width / WIDTH_STEP) * WIDTH_STEP
      // Wider than the tiles, or a new sharpness: every pixel changes.
      if (width > painted.width || ratio !== painted.ratio || scale !== painted.scale) {
        clear()
        painted = { width: Math.max(width, painted.width), ratio, scale }
      }

      const bodyHeight = document.body.offsetHeight
      layer.style.height = `${bodyHeight}px`
      const pageHeight = Math.max(bodyHeight, window.scrollY + viewport.height)
      const plan = tilePlan(window.scrollY, viewport.height, overdraw.height, pageHeight)
      for (const [index, tile] of tiles) {
        if (index < plan.keepFrom || index > plan.keepTo) {
          tile.remove()
          tiles.delete(index)
          sites.delete(index)
        }
      }
      for (const index of plan.visible) {
        if (!paintTile(index)) return tryLater()
      }
      const ahead = plan.ahead.filter((index) => !tiles.has(index))
      if (!ahead.length) return
      if (!paintTile(ahead[0])) return tryLater()
      if (ahead.length > 1) schedule()
    }

    function schedule() {
      if (!frame) frame = requestAnimationFrame(tick)
    }

    // ---- Sparkle: elements over the tiles, animated by the browser's
    // compositor, so the painting is never touched and they scroll with the
    // page without lagging (docs/background.md § "Sparkle").

    const motion = window.matchMedia('(prefers-reduced-motion: no-preference)')
    const sparkles = new Set<Animation>()
    const burstTimers = new Set<ReturnType<typeof setTimeout>>()
    let glintTimer: ReturnType<typeof setTimeout> | undefined
    let starTimer: ReturnType<typeof setTimeout> | undefined
    // The sites glinting now, so a site never glints twice at once.
    const glinting = new Set<Site>()
    const pick = () => pickSite(allSites(), view(), Math.random, glinting)

    const view = (): View => ({ top: window.scrollY, width: window.innerWidth, height: window.innerHeight })
    function* allSites() {
      for (const list of sites.values()) yield* list
    }

    // Adds a sparkle to the layer for as long as its animation runs.
    const sparkle = (
      element: HTMLElement,
      keyframes: Keyframe[],
      options: KeyframeAnimationOptions,
      onDone?: () => void,
    ) => {
      if (typeof element.animate !== 'function') return false
      layer.appendChild(element)
      const animation = element.animate(keyframes, options)
      sparkles.add(animation)
      const done = () => {
        if (!sparkles.delete(animation)) return
        element.remove()
        onDone?.()
      }
      animation.onfinish = done
      animation.oncancel = done
      return true
    }

    const glint = (site: Site | null, inBurst = false) => {
      if (!site || (!inBurst && glinting.size >= MAX_GLINTS)) return
      const element = document.createElement('span')
      element.className = 'galaxy-glint'
      const size = 12 + site.radius * 5
      element.style.left = `${site.x - size / 2}px`
      element.style.top = `${site.y - size / 2}px`
      element.style.width = element.style.height = `${size}px`
      const turn = Math.random() * 30
      const shown = sparkle(
        element,
        [
          { opacity: 0, transform: `scale(0.3) rotate(${turn}deg)` },
          { opacity: 0.55 + 0.45 * site.gold, transform: `scale(1) rotate(${turn + 20}deg)`, offset: 0.4 },
          { opacity: 0, transform: `scale(0.3) rotate(${turn + 45}deg)` },
        ],
        { duration: between(1400, 2400, Math.random), easing: 'ease-in-out' },
        () => glinting.delete(site),
      )
      // Never finishes before this: animations end in a later task.
      if (shown) glinting.add(site)
    }

    const fall = () => {
      const star = shootingStar(view(), Math.random)
      const element = document.createElement('span')
      element.className = 'galaxy-shooting-star'
      element.style.left = `${star.x - star.length}px`
      element.style.top = `${star.y - 1}px`
      element.style.width = `${star.length}px`
      const at = (progress: number, opacity: number): Keyframe => ({
        offset: progress,
        opacity,
        transform: `rotate(${star.angle}deg) translateX(${star.distance * progress}px) scaleX(${0.15 + 0.85 * Math.min(progress / 0.3, 1)})`,
      })
      sparkle(element, [at(0, 0), at(0.15, 1), at(0.6, 1), at(1, 0)], { duration: star.duration, easing: 'linear' })
    }

    const lively = () => motion.matches && !document.hidden
    const glintLater = () => {
      glintTimer = setTimeout(
        () => {
          glint(pick())
          glintLater()
        },
        between(...GLINT_EVERY, Math.random),
      )
    }
    const fallLater = () => {
      starTimer = setTimeout(
        () => {
          fall()
          fallLater()
        },
        between(...SHOOTING_STAR_EVERY, Math.random),
      )
    }
    const stopSparkle = () => {
      clearTimeout(glintTimer)
      clearTimeout(starTimer)
      glintTimer = starTimer = undefined
    }
    const startSparkle = () => {
      if (!lively() || glintTimer) return
      glintLater()
      fallLater()
    }
    const sparkleChanged = () => (lively() ? startSparkle() : stopSparkle())

    const celebrate = () => {
      if (!motion.matches) return
      for (let i = 0; i < BURST_GLINTS; i++) {
        const timer = setTimeout(
          () => {
            burstTimers.delete(timer)
            glint(pick(), true)
          },
          (i / BURST_GLINTS) * BURST_LENGTH,
        )
        burstTimers.add(timer)
      }
      fall()
    }

    tick()
    startSparkle()
    motion.addEventListener('change', sparkleChanged)
    document.addEventListener('visibilitychange', sparkleChanged)
    window.addEventListener(CELEBRATE_EVENT, celebrate)
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    // The page getting taller or shorter.
    const observer = new ResizeObserver(schedule)
    observer.observe(document.body)

    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(retry)
      stopSparkle()
      for (const timer of burstTimers) clearTimeout(timer)
      for (const animation of [...sparkles]) animation.cancel()
      motion.removeEventListener('change', sparkleChanged)
      document.removeEventListener('visibilitychange', sparkleChanged)
      window.removeEventListener(CELEBRATE_EVENT, celebrate)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      observer.disconnect()
      clear()
      painter.dispose()
    }
  }, [])

  return <div ref={layerRef} className="galaxy-background" aria-hidden="true" />
}
