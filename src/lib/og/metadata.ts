import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { Metadata } from 'next'
import { IMAGE } from './layout'

/**
 * Metadata for a page with a link preview (docs/share-previews.md
 * § "The page's metadata"). `image` is the picture's address on the site.
 * Messaging apps need it to be absolute, so it's resolved against the site's
 * own address.
 */
export function shareMetadata({
  title,
  description,
  image,
}: {
  title: string
  description: string
  image: string
}): Metadata {
  const picture = { url: image, ...IMAGE, type: 'image/jpeg', alt: `${title}: date ideas on a starry background` }
  return {
    metadataBase: new URL(getCloudflareContext().env.BETTER_AUTH_URL),
    title,
    description,
    openGraph: { title, description, type: 'website', siteName: 'Build-a-Date', images: [picture] },
    twitter: { card: 'summary_large_image', title, description, images: [picture] },
  }
}
