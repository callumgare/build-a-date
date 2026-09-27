import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { Metadata } from 'next'

/**
 * Metadata for a page with a link preview (docs/share-previews.md
 * § "The page's metadata"). The image itself comes from the page's
 * opengraph-image file. The site's own address makes the image's URL absolute,
 * which messaging apps need.
 */
export function shareMetadata({ title, description }: { title: string; description: string }): Metadata {
  return {
    metadataBase: new URL(getCloudflareContext().env.BETTER_AUTH_URL),
    title,
    description,
    openGraph: { title, description, type: 'website', siteName: 'Build-a-Date' },
    twitter: { card: 'summary_large_image', title, description },
  }
}
