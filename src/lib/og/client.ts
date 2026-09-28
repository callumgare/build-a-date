import type { SentPreview } from '@/lib/previews'
import type { PreviewInput } from './preview'
import { previewKey } from './preview-key'

// The browser's side of link previews (docs/share-previews.md § "When it's
// drawn"). The drawing code (Satori, fonts, the background) is only loaded
// when a picture is wanted.

/** The drawing code, loaded when a picture is wanted. */
export function loadDraw() {
  return import('./draw')
}

/** Starts loading what drawing needs, so a picture asked for soon after is quick. */
export function preloadPreview() {
  loadDraw()
    .then(({ loadPreviewAssets }) => loadPreviewAssets())
    .catch(() => {})
}

/** Draws the picture, with the key of what it shows, or gives up after `timeout` ms. */
export async function drawPreview(input: PreviewInput, timeout = 3000): Promise<SentPreview> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const tooLong = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Drawing the link preview took too long')), timeout)
  })
  try {
    const { drawSharePreview } = await Promise.race([loadDraw(), tooLong])
    const image = await Promise.race([drawSharePreview(input), tooLong])
    return { key: previewKey(input), image }
  } finally {
    clearTimeout(timer)
  }
}
