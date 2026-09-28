import { renderToStaticMarkup } from 'react-dom/server'
import { frames } from '@/components/frames'
import { PreviewFrame, titleScale } from './card'

/** @see docs/share-previews.md § "The cards" */
describe('the preview card', () => {
  it('steps a title down as it gets longer', () => {
    const scales = ['Picnic', 'Farmers’ Market Breakfast', 'A long walk along the beach at sunset', 'x'.repeat(60)].map(
      titleScale,
    )
    expect(scales).toEqual([...scales].sort((a, b) => b - a))
    expect(new Set(scales).size).toBe(scales.length)
  })

  it('draws every frame inline, with its rails stretched between the top and bottom pieces', () => {
    for (const frame of frames) {
      const svg = renderToStaticMarkup(<PreviewFrame frame={frame} width={192} height={256} left={4} top={4} />)
      expect(svg).toMatch(
        /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" width="192" height="256" viewBox="0 0 200 266.667"/,
      )
      // No pictures inside it, which Firefox might not have loaded when it's drawn.
      expect(svg).not.toContain('<image')
      // The page's classes, as attributes, since the drawing has no stylesheet.
      expect(svg).not.toContain('class=')
      const bottom = Math.round((266.667 - frame.bottom.height) * 1000) / 1000
      expect(svg).toContain(`M ${frame.rails[0]} ${frame.top.height} V ${bottom}`)
      expect(svg).toContain(`translate(0 ${bottom})`)
    }
  })

  it("fills the art that's filled on the page, and fades what's faint", () => {
    const svg = frames.map((frame) =>
      renderToStaticMarkup(<PreviewFrame frame={frame} width={192} height={256} left={0} top={0} />),
    )
    expect(svg.join('')).toContain('fill="#a07c4c" stroke="none"')
    expect(svg.join('')).toContain('opacity="0.55"')
  })
})
