import { glslPalette, hexToLinear, palette } from './palette'
import { fragmentShader } from './shader'

describe('hexToLinear', () => {
  it('keeps black and white at the ends', () => {
    expect(hexToLinear('#000000')).toEqual([0, 0, 0])
    expect(hexToLinear('#ffffff')).toEqual([1, 1, 1])
  })

  it('undoes the sRGB curve', () => {
    const [r, g, b] = hexToLinear('#808080')
    expect(r).toBeCloseTo(0.2159, 4)
    expect(g).toBe(r)
    expect(b).toBe(r)
  })

  it('reads each channel from its own place in the hex', () => {
    const [r, g, b] = hexToLinear('#ff0080')
    expect(r).toBe(1)
    expect(g).toBe(0)
    expect(b).toBeCloseTo(0.2159, 4)
  })
})

/** @see docs/background.md § "The palette" - the only place a colour is defined */
describe('glslPalette', () => {
  it('gives the shader every colour in the palette', () => {
    for (const name of Object.keys(palette)) {
      const constant = name.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()
      expect(fragmentShader).toContain(`const vec3 ${constant} = vec3(`)
    }
  })

  it('writes the colours in linear light', () => {
    expect(glslPalette()).toContain('const vec3 GOLD = vec3(0.73046, 0.50888, 0.12477);')
  })
})
