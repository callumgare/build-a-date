// The start of a JPEG, as far as a size check reads: its start marker, a JFIF
// header and a start-of-frame giving the width and height. `padding` makes it
// bigger.
export function fakeJpeg({ width = 1200, height = 630, padding = 0 } = {}) {
  const jfif = [0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 1, 1, 0, 0, 1, 0, 1, 0, 0]
  const frame = [
    0xff,
    0xc0,
    0x00,
    0x11,
    0x08,
    height >> 8,
    height & 255,
    width >> 8,
    width & 255,
    3,
    1,
    0x22,
    0,
    2,
    0x11,
    1,
    3,
    0x11,
    1,
  ]
  return new Uint8Array([0xff, 0xd8, ...jfif, ...frame, ...new Array<number>(padding).fill(0), 0xff, 0xd9])
}

export function fakeJpegBlob(options?: Parameters<typeof fakeJpeg>[0]) {
  return new Blob([fakeJpeg(options)], { type: 'image/jpeg' })
}
