import { fragmentShader, vertexShader } from './shader'

export type Painter = {
  /**
   * Paints the part of the page at `top` (CSS pixels from the top of the page)
   * into `tile`, at `ratio` device pixels per CSS pixel. Returns false if it
   * couldn't, because the GPU context has been lost.
   */
  paint(tile: HTMLCanvasElement, top: number, ratio: number, scale: number): boolean
  dispose(): void
}

/** The same picture on every visit (docs/background.md § "The same every time"). */
export const DEFAULT_SEED = 7

/**
 * How big the swirls and specks are drawn, as CSS pixels per pixel of the
 * photo. The photo was shrunk to fit the screen, so it looked finer on a phone
 * than on a desktop. This keeps that, but goes by the screen rather than the
 * window, so resizing a window doesn't rescale the picture
 * (docs/background.md § "How it's drawn").
 */
export function featureScale(screenWidth: number, screenHeight: number): number {
  return Math.min(0.85, Math.max(0.45, Math.max(screenWidth, screenHeight) / 2200))
}

/** Sharper than this costs a lot of pixels for grain nobody can see. */
export const MAX_PIXEL_RATIO = 2

/**
 * How wide the tiles are, and how tall a window they're painted ahead for:
 * the whole screen, so making the window bigger only shows what's already
 * there. Phones and tablets are covered both ways up, since they turn. Never
 * less than the window itself (docs/background.md § "Overdrawn").
 */
export function overdrawSize(
  screen: { width: number; height: number },
  viewport: { width: number; height: number },
  turns: boolean,
): { width: number; height: number } {
  const longest = Math.max(screen.width, screen.height)
  return {
    width: Math.max(turns ? longest : screen.width, viewport.width),
    height: Math.max(turns ? longest : screen.height, viewport.height),
  }
}

/**
 * Sets up the shader on an offscreen canvas that paints the tiles one at a
 * time, or returns null where WebGL 2 isn't available and the fallback colour
 * has to do (docs/background.md § "Fallback").
 */
export function createPainter(seed = DEFAULT_SEED): Painter | null {
  const canvas = document.createElement('canvas')
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, powerPreference: 'low-power' })
  if (!gl) return null
  let program = link(gl, fragmentShader)
  if (!program) return null

  // The painted tiles are 2D canvases, so losing the context loses nothing on
  // screen; painting just waits until it's back.
  let lost = false
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault()
    lost = true
  })
  canvas.addEventListener('webglcontextrestored', () => {
    program = link(gl, fragmentShader)
    lost = !program
  })

  return {
    paint(tile, top, ratio, scale) {
      const context = tile.getContext('2d', { alpha: false })
      if (lost || !program || !context) return false
      canvas.width = tile.width
      canvas.height = tile.height
      gl.viewport(0, 0, canvas.width, canvas.height)
      // biome-ignore lint/correctness/useHookAtTopLevel: WebGL's useProgram, not a React hook
      gl.useProgram(program)
      gl.uniform1ui(gl.getUniformLocation(program, 'uSeed'), seed)
      gl.uniform1f(gl.getUniformLocation(program, 'uHeight'), canvas.height)
      gl.uniform1f(gl.getUniformLocation(program, 'uRatio'), ratio * scale)
      gl.uniform2f(gl.getUniformLocation(program, 'uOrigin'), 0, top / scale)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      // Still in the same task, so the drawing buffer is there to copy.
      context.drawImage(canvas, 0, 0)
      return true
    },
    dispose() {
      if (program) gl.deleteProgram(program)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    },
  }
}

function link(gl: WebGL2RenderingContext, fragmentShader: string): WebGLProgram | null {
  const program = gl.createProgram()
  const shaders = [compile(gl, gl.VERTEX_SHADER, vertexShader), compile(gl, gl.FRAGMENT_SHADER, fragmentShader)]
  for (const shader of shaders) {
    if (!shader) return null
    gl.attachShader(program, shader)
  }
  gl.linkProgram(program)
  for (const shader of shaders) if (shader) gl.deleteShader(shader)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Background shader failed to link:', gl.getProgramInfoLog(program))
    return null
  }
  return program
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Background shader failed to compile:', gl.getShaderInfoLog(shader))
    return null
  }
  return shader
}
