import satori from 'satori'
import { IMAGE } from './layout'
import { PreviewImage, type PreviewInput } from './preview'

// Draws a link preview in the browser (docs/share-previews.md § "Drawing in
// the browser"). The Worker can't: on Cloudflare's free plan a request gets
// 10 ms of CPU, far too little to draw a picture. Satori lays the picture
// out as an SVG, and a canvas turns that into a JPEG. Only loaded with
// import(), when a picture is needed.
//
// Firefox loads pictures inside an SVG in its own time, and drawing it onto
// the canvas doesn't wait for them. So the galaxy still goes onto the canvas
// first, with the SVG over it, and the pictures the SVG still has (frames,
// emoji) are decoded before it's drawn.

type Assets = { background: ImageBitmap; tanPearl: ArrayBuffer; lora: ArrayBuffer }

let assets: Promise<Assets> | undefined

/** Starts loading the fonts and background, so a picture asked for later draws quickly. */
export function loadPreviewAssets() {
  if (!assets) {
    assets = Promise.all([
      fetchAsset('/og/background.jpg'),
      fetchAsset('/tan-pearl.otf'),
      fetchAsset('/og/lora-semibold.ttf'),
    ]).then(async ([background, tanPearl, lora]) => ({
      background: await createImageBitmap(new Blob([background], { type: 'image/jpeg' })),
      tanPearl,
      lora,
    }))
    // A failure isn't kept, so the next picture tries again.
    assets.catch(() => {
      assets = undefined
    })
  }
  return assets
}

export async function drawSharePreview(input: PreviewInput): Promise<Blob> {
  const { background, tanPearl, lora } = await loadPreviewAssets()
  const svg = await satori(<PreviewImage input={input} />, {
    ...IMAGE,
    fonts: [
      { name: 'Tan Pearl', data: tanPearl, style: 'normal', weight: 400 },
      { name: 'Lora', data: lora, style: 'normal', weight: 600 },
    ],
    loadAdditionalAsset: async (code, segment) => (code === 'emoji' ? emoji(segment) : []),
  })
  // Browsers blur filters in linear light, which washes the title's dark halo
  // out to almost nothing. CSS text-shadow, and resvg, blur in sRGB.
  return rasterise(background, svg.replaceAll('<filter ', '<filter color-interpolation-filters="sRGB" '))
}

async function rasterise(background: ImageBitmap, svg: string) {
  await decodeInnerPictures(svg)
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  try {
    const image = new Image(IMAGE.width, IMAGE.height)
    image.src = url
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = IMAGE.width
    canvas.height = IMAGE.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('No canvas to draw the preview on')
    // The background's own colour first, in case the still doesn't cover it all.
    context.fillStyle = '#0e1a57'
    context.fillRect(0, 0, IMAGE.width, IMAGE.height)
    context.drawImage(background, 0, 0, IMAGE.width, IMAGE.height)
    context.drawImage(image, 0, 0, IMAGE.width, IMAGE.height)
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('The preview could not be drawn'))),
        'image/jpeg',
        0.85,
      ),
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}

// Satori puts the frames and emoji in the SVG as pictures of their own.
// Firefox loads those in its own time, and drawing the SVG onto the canvas
// doesn't wait for them, so a picture drawn first came out without frames.
// Decoding each one beforehand means they're ready when it's drawn.
async function decodeInnerPictures(svg: string) {
  const sources = new Set(
    Array.from(svg.matchAll(/href="(data:[^"]+)"/g), (match) => match[1].replaceAll('&amp;', '&')),
  )
  await Promise.all(
    [...sources].map((source) => {
      const picture = new Image()
      picture.src = source
      return picture.decode().catch(() => {})
    }),
  )
}

// Tried twice, since a dropped request would otherwise mean no picture this
// visit.
async function fetchAsset(path: string, tries = 2): Promise<ArrayBuffer> {
  try {
    const response = await fetch(path)
    if (!response.ok) throw new Error(`Couldn't load ${path}: ${response.status}`)
    return await response.arrayBuffer()
  } catch (error) {
    if (tries <= 1) throw error
    await new Promise((resolve) => setTimeout(resolve, 500))
    return fetchAsset(path, tries - 1)
  }
}

// An emoji in a title, as Twemoji draws it. Named by its code points, without
// the variation selector unless it joins others.
async function emoji(segment: string) {
  const points = [...segment].map((character) => character.codePointAt(0)?.toString(16) ?? '')
  const name = (segment.includes('‍') ? points : points.filter((point) => point !== 'fe0f')).join('-')
  // Without it, the title just goes without the emoji: not worth losing the
  // picture over.
  try {
    const response = await fetch(`https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg/${name}.svg`)
    if (!response.ok) return []
    return `data:image/svg+xml;base64,${btoa(await response.text())}`
  } catch {
    return []
  }
}
