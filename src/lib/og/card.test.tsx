import { frames } from '@/components/frames'
import { frameSvg, titleScale } from './card'

/** @see docs/share-previews.md § "The cards" */
describe('the preview card', () => {
  it('steps a title down as it gets longer', () => {
    const scales = ['Picnic', 'Farmers’ Market Breakfast', 'A long walk along the beach at sunset', 'x'.repeat(60)].map(
      titleScale,
    )
    expect(scales).toEqual([...scales].sort((a, b) => b - a))
    expect(new Set(scales).size).toBe(scales.length)
  })

  it('draws every frame as one SVG, with its rails stretched between the top and bottom pieces', () => {
    for (const frame of frames) {
      const svg = frameSvg(frame, 192, 256)
      expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" width="192" height="256"/)
      expect(svg).not.toContain('className')
      expect(svg).not.toContain('[object Object]')
      // 256px tall at 0.96px a unit is 266.667 units.
      const bottom = 266.667 - frame.bottom.height
      expect(svg).toContain(`M ${frame.rails[0]} ${frame.top.height} V ${Math.round(bottom * 1000) / 1000}`)
      expect(svg).toContain(`translate(0 ${Math.round(bottom * 1000) / 1000})`)
    }
  })
})
