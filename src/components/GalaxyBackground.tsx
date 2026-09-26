'use client'

import { useEffect, useRef } from 'react'
import { createPainter, featureScale, MAX_PIXEL_RATIO, overdrawSize } from './galaxy/render'
import { TILE_HEIGHT, tilePlan } from './galaxy/tiles'

/** The tiles' width is rounded up to this, so a drag past the screen grows it in steps. */
const WIDTH_STEP = 128

/** How long to wait before trying again when the GPU context has been lost. */
const RETRY_DELAY = 1000

/**
 * The swirling blue and gold behind every page. It scrolls with the page,
 * painted in tiles near what's on screen and let go further away
 * (docs/background.md). Where it can't be drawn, the layer's own colour
 * shows through.
 */
export default function GalaxyBackground() {
  const layerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const layer = layerRef.current
    if (!layer) return
    const painter = createPainter()
    if (!painter) return

    const tiles = new Map<number, HTMLCanvasElement>()
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
      return true
    }

    const clear = () => {
      for (const tile of tiles.values()) tile.remove()
      tiles.clear()
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

    tick()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    // The page getting taller or shorter.
    const observer = new ResizeObserver(schedule)
    observer.observe(document.body)

    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(retry)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      observer.disconnect()
      clear()
      painter.dispose()
    }
  }, [])

  return <div ref={layerRef} className="galaxy-background" aria-hidden="true" />
}
