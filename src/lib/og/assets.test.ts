import { env, resetEnv } from '@/test/cloudflare'
import { loadAsset } from './assets'

vi.mock('@opennextjs/cloudflare', () => import('@/test/cloudflare'))

afterEach(() => {
  resetEnv()
  vi.unstubAllGlobals()
})

/** @see docs/share-previews.md § "Fonts and assets" */
describe('loadAsset', () => {
  it("loads a file from the Worker's static assets, and keeps it", async () => {
    const assets = vi.spyOn(env.ASSETS, 'fetch')
    const font = await loadAsset('/tan-pearl.otf')
    expect(font.byteLength).toBeGreaterThan(0)
    expect(await loadAsset('/tan-pearl.otf')).toBe(font)
    expect(assets).toHaveBeenCalledTimes(1)
  })

  it("fetches it from the site when the static assets don't have it", async () => {
    const site = vi.fn(async () => new Response('from the site'))
    vi.stubGlobal('fetch', site)
    const asset = await loadAsset('/only-on-the-site.txt')
    expect(new TextDecoder().decode(asset)).toBe('from the site')
    expect(site).toHaveBeenCalledWith(new URL('http://localhost:3000/only-on-the-site.txt'))
  })

  it("tries again next time when it can't be loaded", async () => {
    const site = vi.fn(async () => new Response('Not found', { status: 404 }))
    vi.stubGlobal('fetch', site)
    await expect(loadAsset('/missing.txt')).rejects.toThrow("Couldn't load /missing.txt: 404")
    await expect(loadAsset('/missing.txt')).rejects.toThrow()
    expect(site).toHaveBeenCalledTimes(2)
  })
})
