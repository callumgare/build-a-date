import { getCloudflareContext } from '@opennextjs/cloudflare'

// The fonts and background the preview image is drawn with, from public/
// (docs/share-previews.md § "Fonts and assets"). On Cloudflare they come from
// the Worker's static assets. Under `next dev`, ASSETS serves the last
// OpenNext build, which may be missing them or have old copies, so there
// they're always fetched from the site, which serves public/ as it is now.

const loaded = new Map<string, Promise<ArrayBuffer>>()

export function loadAsset(path: string): Promise<ArrayBuffer> {
  let asset = loaded.get(path)
  if (!asset) {
    asset = fetchAsset(path)
    // A failure isn't kept, so the next image tries again.
    asset.catch(() => loaded.delete(path))
    loaded.set(path, asset)
  }
  return asset
}

async function fetchAsset(path: string) {
  const { env } = getCloudflareContext()
  const url = new URL(path, env.BETTER_AUTH_URL)
  const assets = process.env.NODE_ENV === 'development' ? undefined : env.ASSETS
  let response = assets ? await assets.fetch(url) : undefined
  if (!response?.ok) response = await fetch(url)
  if (!response.ok) throw new Error(`Couldn't load ${path}: ${response.status}`)
  return response.arrayBuffer()
}
