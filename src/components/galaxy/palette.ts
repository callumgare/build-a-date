/**
 * The background's colours, measured from the photo it replaces
 * (docs/background.md § "The palette").
 */
export const palette = {
  /** The shadowed trough beside each ridge. */
  trough: '#05103a',
  /** The bulk of the picture. */
  body: '#0e1a57',
  /** A ridge's raised side. */
  lit: '#272f88',
  /** The top of a ridge. */
  raised: '#384688',
  /** The lavender sheen where a ridge faces the light. */
  sheen: '#5a5f90',
  /** The fine mottle between the specks. */
  grain: '#1f288c',
  dustDim: '#303793',
  dust: '#5a6198',
  dustBright: '#818ab0',
  /** The fringe of a vein, where flakes are part covered by blue. */
  goldDim: '#a49c71',
  /** The centres of the flakes. */
  goldPale: '#e0c492',
  gold: '#debd63',
  star: '#f4f1ff',
} as const

export type PaletteName = keyof typeof palette

/** An sRGB hex colour as linear RGB, which is what the shader blends in. */
export function hexToLinear(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.replace('#', ''), 16)
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255]
  return channels.map((channel) => {
    const c = channel / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
}

/** The palette as GLSL constants, e.g. `const vec3 TROUGH = vec3(…);`. */
export function glslPalette(): string {
  return Object.entries(palette)
    .map(([name, hex]) => {
      const constant = name.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()
      const [r, g, b] = hexToLinear(hex).map((c) => c.toFixed(5))
      return `const vec3 ${constant} = vec3(${r}, ${g}, ${b});`
    })
    .join('\n')
}
