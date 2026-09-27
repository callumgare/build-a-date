// The width and height in a PNG's header, for tests of the preview images.
export async function pngSize(response: Response) {
  const bytes = new DataView(await response.arrayBuffer())
  return { width: bytes.getUint32(16), height: bytes.getUint32(20) }
}
