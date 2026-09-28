import { IMAGE } from './layout'

// What a preview picture sent from a browser must be before it's kept
// (docs/share-previews.md § "Who can upload a picture"): a 1200×630 JPEG,
// no bigger than MAX_PREVIEW_BYTES.

export const MAX_PREVIEW_BYTES = 1024 * 1024

export function checkPreviewImage(bytes: Uint8Array): string | null {
  if (bytes.byteLength > MAX_PREVIEW_BYTES) return 'The picture is too big'
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) return 'The picture isn’t a JPEG'
  const size = jpegSize(bytes)
  if (!size || size.width !== IMAGE.width || size.height !== IMAGE.height) return 'The picture is the wrong size'
  return null
}

/** Reads the width and height from a JPEG's start-of-frame marker. */
export function jpegSize(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 2
  while (offset + 4 <= bytes.byteLength) {
    if (bytes[offset] !== 0xff) return null
    const marker = bytes[offset + 1]
    // Padding between markers.
    if (marker === 0xff) {
      offset++
      continue
    }
    const length = view.getUint16(offset + 2)
    // SOF0–SOF15, apart from DHT (C4), JPG (C8) and DAC (CC).
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      if (offset + 9 > bytes.byteLength) return null
      return { height: view.getUint16(offset + 5), width: view.getUint16(offset + 7) }
    }
    offset += 2 + length
  }
  return null
}
