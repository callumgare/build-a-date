import { fakeJpeg } from '@/test/jpeg'
import { checkPreviewImage, jpegSize, MAX_PREVIEW_BYTES } from './jpeg'

/** @see docs/share-previews.md § "Who can upload a picture" - only a 1200×630 JPEG of at most 1 MB */
describe('checkPreviewImage', () => {
  it('accepts a 1200×630 JPEG', () => {
    expect(jpegSize(fakeJpeg())).toEqual({ width: 1200, height: 630 })
    expect(checkPreviewImage(fakeJpeg())).toBeNull()
  })

  it('refuses a JPEG of the wrong size', () => {
    expect(checkPreviewImage(fakeJpeg({ width: 600, height: 315 }))).toBe('The picture is the wrong size')
  })

  it('refuses anything that isn’t a JPEG', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    expect(checkPreviewImage(png)).toBe('The picture isn’t a JPEG')
    expect(checkPreviewImage(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]))).toBe('The picture is the wrong size')
  })

  it('refuses a picture over 1 MB', () => {
    expect(checkPreviewImage(fakeJpeg({ padding: MAX_PREVIEW_BYTES }))).toBe('The picture is too big')
  })
})
