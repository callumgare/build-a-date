import { getCloudflareContext } from '@opennextjs/cloudflare'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import DevPreviews from '@/components/dev/DevPreviews'

// Draws the static link previews, for `npm run og:images` to save into
// public/og/ (docs/share-previews.md § "The static pictures"). Only on
// localhost.
export default async function DevPreviewsPage() {
  // Per request, not at build time: whether it's there depends on where it runs.
  await connection()
  if (new URL(getCloudflareContext().env.BETTER_AUTH_URL).hostname !== 'localhost') notFound()
  return <DevPreviews />
}
