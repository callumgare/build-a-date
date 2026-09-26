/** @vitest-environment jsdom */
import { act, render } from '@testing-library/react'
import GalaxyBackground from './GalaxyBackground'
import { createPainter, type Painter } from './galaxy/render'
import { celebrate, type Site } from './galaxy/sparkle'
import { TILE_HEIGHT } from './galaxy/tiles'

// jsdom has no WebGL, so the painting itself is covered in e2e/background.spec.ts.
vi.mock('./galaxy/render', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./galaxy/render')>()),
  createPainter: vi.fn(),
}))

// Animation frames that only run when a test says so.
let frames = new Map<number, FrameRequestCallback>()
let nextFrame = 1
function runFrames(count = 1) {
  for (let i = 0; i < count; i++) {
    const due = [...frames.values()]
    frames = new Map()
    act(() => {
      for (const callback of due) callback(0)
    })
  }
}

let touchScreen = false
let motionOk = false
let motionChanged: (() => void) | undefined

function setMotion(ok: boolean) {
  motionOk = ok
  act(() => motionChanged?.())
}

// jsdom can't animate, so each animation is kept for a test to finish.
type FakeAnimation = { onfinish: (() => void) | null; oncancel: (() => void) | null; cancel(): void; finish(): void }
let animations: FakeAnimation[] = []
function fakeAnimate() {
  const animation: FakeAnimation = {
    onfinish: null,
    oncancel: null,
    cancel() {
      this.oncancel?.()
    },
    finish() {
      this.onfinish?.()
    },
  }
  animations.push(animation)
  return animation as unknown as Animation
}

function define(target: object, values: Record<string, number>) {
  for (const [key, value] of Object.entries(values)) {
    Object.defineProperty(target, key, { value, configurable: true })
  }
}

function setWindow(width: number, height: number) {
  define(window, { innerWidth: width, innerHeight: height })
}

function setPageHeight(height: number) {
  define(document.body, { offsetHeight: height })
}

function scrollTo(y: number) {
  define(window, { scrollY: y })
  window.dispatchEvent(new Event('scroll'))
  runFrames()
}

// Every tile has one gold clump, 100 CSS pixels in from its top left.
function fakePainter(): Painter {
  return {
    paint: vi.fn(() => true),
    sites: vi.fn((top: number): Site[] => [{ x: 100, y: top + 100, gold: 1, radius: 1 }]),
    dispose: vi.fn(),
  }
}

function glints() {
  return [...layer().querySelectorAll<HTMLElement>('.galaxy-glint')]
}

function shootingStars() {
  return layer().querySelectorAll('.galaxy-shooting-star')
}

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { value: hidden, configurable: true })
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

function layer() {
  const element = document.querySelector('.galaxy-background')
  if (!(element instanceof HTMLElement)) throw new Error('No background layer')
  return element
}

/** The tiles on the page, by the index of their place down it. */
function tileIndices() {
  return [...layer().querySelectorAll('canvas')]
    .map((tile) => Number.parseInt(tile.style.top, 10) / TILE_HEIGHT)
    .sort((a, b) => a - b)
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(nextFrame, callback)
    return nextFrame++
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
  define(window.screen, { width: 1920, height: 1080 })
  define(window, { devicePixelRatio: 2, scrollY: 0 })
  setWindow(1024, 768)
  setPageHeight(20 * TILE_HEIGHT)
  touchScreen = false
  motionOk = false
  animations = []
  Element.prototype.animate = vi.fn(fakeAnimate)
  vi.stubGlobal('matchMedia', (media: string) => ({
    get matches() {
      if (media.includes('reduced-motion')) return motionOk
      return media.includes('pointer') ? touchScreen : false
    },
    media,
    addEventListener(_: string, listener: () => void) {
      if (media.includes('reduced-motion')) motionChanged = listener
    },
    removeEventListener() {
      if (media.includes('reduced-motion')) motionChanged = undefined
    },
  }))
})

afterEach(() => {
  frames = new Map()
  for (const key of ['width', 'height']) Reflect.deleteProperty(window.screen, key)
  for (const key of ['innerWidth', 'innerHeight', 'devicePixelRatio', 'scrollY']) Reflect.deleteProperty(window, key)
  Reflect.deleteProperty(document.body, 'offsetHeight')
  Reflect.deleteProperty(document, 'hidden')
  Reflect.deleteProperty(Element.prototype, 'animate')
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.mocked(createPainter).mockReset()
})

describe('GalaxyBackground', () => {
  it('is hidden from assistive technology', () => {
    vi.mocked(createPainter).mockReturnValue(fakePainter())
    render(<GalaxyBackground />)
    expect(layer()).toHaveAttribute('aria-hidden', 'true')
  })

  /** @see docs/background.md § "Fallback" */
  it('leaves just its own colour where WebGL 2 is not available', () => {
    vi.mocked(createPainter).mockReturnValue(null)
    render(<GalaxyBackground />)
    expect(tileIndices()).toEqual([])
    expect(frames.size).toBe(0)
  })

  /** @see docs/background.md § "Tiles" */
  describe('tiles', () => {
    it('paints what the window shows straight away, then the rest one frame at a time', () => {
      vi.mocked(createPainter).mockReturnValue(fakePainter())
      render(<GalaxyBackground />)
      // The three it shows, and the first one past them.
      expect(tileIndices()).toEqual([0, 1, 2, 3])
      runFrames()
      expect(tileIndices()).toEqual([0, 1, 2, 3, 4])
      runFrames(10)
      // A screen's height (1080) past the window's 768.
      expect(tileIndices()).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
      expect(frames.size).toBe(0)
    })

    it('places each tile down the page and paints it for that place', () => {
      const painter = fakePainter()
      vi.mocked(createPainter).mockReturnValue(painter)
      render(<GalaxyBackground />)
      const tile = layer().querySelector<HTMLCanvasElement>('canvas[style*="top: 256px"]')
      expect(tile).not.toBeNull()
      expect(painter.paint).toHaveBeenCalledWith(tile, 256, 2, expect.any(Number))
      expect(tile?.height).toBe(TILE_HEIGHT * 2)
    })

    it('is as tall as the page', () => {
      vi.mocked(createPainter).mockReturnValue(fakePainter())
      setPageHeight(3000)
      render(<GalaxyBackground />)
      expect(layer().style.height).toBe('3000px')
    })

    it('paints what scrolls into view and lets go of what is far behind', () => {
      vi.mocked(createPainter).mockReturnValue(fakePainter())
      setPageHeight(200 * TILE_HEIGHT)
      render(<GalaxyBackground />)
      scrollTo(100 * TILE_HEIGHT)
      expect(tileIndices()).toEqual(expect.arrayContaining([100, 101, 102]))
      expect(tileIndices()).not.toContain(0)
    })

    it('tries again later when it could not paint', () => {
      const painter = fakePainter()
      vi.mocked(painter.paint).mockReturnValue(false)
      vi.mocked(createPainter).mockReturnValue(painter)
      render(<GalaxyBackground />)
      expect(tileIndices()).toEqual([])
      vi.mocked(painter.paint).mockReturnValue(true)
      act(() => vi.advanceTimersByTime(1000))
      runFrames()
      expect(tileIndices()).toEqual(expect.arrayContaining([0, 1, 2]))
    })
  })

  /** @see docs/background.md § "Overdrawn" */
  describe('overdrawn', () => {
    it('paints tiles as wide as the screen, not just the window', () => {
      vi.mocked(createPainter).mockReturnValue(fakePainter())
      render(<GalaxyBackground />)
      expect(layer().querySelector('canvas')?.style.width).toBe('1920px')
    })

    it('covers a touch screen both ways up, for when it turns', () => {
      touchScreen = true
      define(window.screen, { width: 390, height: 844 })
      setWindow(390, 844)
      vi.mocked(createPainter).mockReturnValue(fakePainter())
      render(<GalaxyBackground />)
      expect(layer().querySelector('canvas')?.style.width).toBe('896px')
    })

    it('keeps its tiles when the window grows within the screen', () => {
      const painter = fakePainter()
      vi.mocked(createPainter).mockReturnValue(painter)
      render(<GalaxyBackground />)
      runFrames(10)
      const before = [...layer().querySelectorAll('canvas')]
      const paints = vi.mocked(painter.paint).mock.calls.length
      setWindow(1600, 1000)
      window.dispatchEvent(new Event('resize'))
      runFrames(10)
      const after = [...layer().querySelectorAll('canvas')]
      expect(after).toEqual(expect.arrayContaining(before))
      // Only tiles new to the taller window get painted.
      const repainted = vi
        .mocked(painter.paint)
        .mock.calls.slice(paints)
        .map(([tile]) => tile)
      expect(repainted.filter((tile) => before.includes(tile))).toEqual([])
    })

    it('paints again for a window wider than the screen', () => {
      vi.mocked(createPainter).mockReturnValue(fakePainter())
      render(<GalaxyBackground />)
      setWindow(2400, 768)
      window.dispatchEvent(new Event('resize'))
      runFrames()
      expect(layer().querySelector('canvas')?.style.width).toBe('2432px')
    })

    it('paints again at a new sharpness, as when zoomed', () => {
      const painter = fakePainter()
      vi.mocked(createPainter).mockReturnValue(painter)
      render(<GalaxyBackground />)
      define(window, { devicePixelRatio: 1 })
      window.dispatchEvent(new Event('resize'))
      runFrames()
      expect(painter.paint).toHaveBeenLastCalledWith(expect.anything(), expect.any(Number), 1, expect.any(Number))
      expect(layer().querySelector('canvas')?.height).toBe(TILE_HEIGHT)
    })
  })

  /** @see docs/background.md § "Sparkle" */
  describe('sparkle', () => {
    beforeEach(() => {
      motionOk = true
      vi.mocked(createPainter).mockReturnValue(fakePainter())
    })

    it('finds the gold that can glint in each tile it paints', () => {
      const painter = fakePainter()
      vi.mocked(createPainter).mockReturnValue(painter)
      render(<GalaxyBackground />)
      expect(painter.sites).toHaveBeenCalledWith(256, 1920, expect.any(Number))
    })

    it('glints gold flakes the window shows, now and then, on top of the tiles', () => {
      render(<GalaxyBackground />)
      act(() => vi.advanceTimersByTime(5000))
      expect(glints().length).toBeGreaterThan(0)
      for (const glint of glints()) {
        const centre = Number.parseFloat(glint.style.top) + Number.parseFloat(glint.style.height) / 2
        expect(centre % TILE_HEIGHT).toBe(100)
        expect(centre).toBeLessThan(768)
      }
    })

    it('never has more than a few glinting at once, and each goes when it has faded', () => {
      render(<GalaxyBackground />)
      act(() => vi.advanceTimersByTime(60_000))
      // Only three tiles' clumps are in the 768 px window.
      expect(glints()).toHaveLength(3)
      act(() => {
        for (const animation of animations) animation.finish()
      })
      expect(glints()).toHaveLength(0)
    })

    it('lets a shooting star fall once in a while', () => {
      render(<GalaxyBackground />)
      expect(shootingStars()).toHaveLength(0)
      act(() => vi.advanceTimersByTime(46_000))
      expect(shootingStars().length).toBeGreaterThan(0)
    })

    it('stays still for someone who asks for reduced motion', () => {
      motionOk = false
      render(<GalaxyBackground />)
      act(() => {
        vi.advanceTimersByTime(60_000)
        celebrate()
        vi.advanceTimersByTime(2000)
      })
      expect(glints()).toHaveLength(0)
      expect(shootingStars()).toHaveLength(0)
    })

    it('stops when reduced motion is turned on, and starts again when it is off', () => {
      render(<GalaxyBackground />)
      setMotion(false)
      act(() => vi.advanceTimersByTime(60_000))
      expect(glints()).toHaveLength(0)
      setMotion(true)
      act(() => vi.advanceTimersByTime(5000))
      expect(glints().length).toBeGreaterThan(0)
    })

    it('rests while the tab is hidden', () => {
      render(<GalaxyBackground />)
      setHidden(true)
      act(() => vi.advanceTimersByTime(60_000))
      expect(glints()).toHaveLength(0)
      expect(shootingStars()).toHaveLength(0)
      setHidden(false)
      act(() => vi.advanceTimersByTime(5000))
      expect(glints().length).toBeGreaterThan(0)
    })

    it('clears its sparkle away when it unmounts', () => {
      const { unmount } = render(<GalaxyBackground />)
      act(() => {
        celebrate()
        vi.advanceTimersByTime(600)
      })
      const layerElement = layer()
      expect(layerElement.querySelectorAll('.galaxy-glint, .galaxy-shooting-star').length).toBeGreaterThan(0)
      const started = animations.length
      unmount()
      expect(layerElement.querySelectorAll('.galaxy-glint, .galaxy-shooting-star')).toHaveLength(0)
      // Nothing more of the burst starts after it's gone.
      act(() => vi.advanceTimersByTime(60_000))
      expect(animations).toHaveLength(started)
    })

    /** @see docs/background.md § "Bursts" */
    it('bursts into glints and a shooting star to celebrate', () => {
      const painter = fakePainter()
      // Plenty of gold in the window, so the burst isn't held back by sites.
      vi.mocked(painter.sites).mockImplementation((top: number) =>
        Array.from({ length: 10 }, (_, i) => ({ x: 20 + i * 60, y: top + 100, gold: 1, radius: 1 })),
      )
      vi.mocked(createPainter).mockReturnValue(painter)
      render(<GalaxyBackground />)
      act(() => {
        celebrate()
        vi.advanceTimersByTime(1200)
      })
      expect(shootingStars()).toHaveLength(1)
      // More than ever glint at once outside a burst.
      expect(glints().length).toBeGreaterThan(6)
    })
  })

  it('lets go of the tiles and the GPU when it unmounts', () => {
    const painter = fakePainter()
    vi.mocked(createPainter).mockReturnValue(painter)
    const { unmount } = render(<GalaxyBackground />)
    const layerElement = layer()
    unmount()
    expect(layerElement.querySelectorAll('canvas')).toHaveLength(0)
    expect(painter.dispose).toHaveBeenCalledOnce()
    expect(frames.size).toBe(0)
  })
})
