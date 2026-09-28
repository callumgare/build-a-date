import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { Metadata } from 'next'
import { IMAGE } from './layout'

/**
 * Metadata for a page with a link preview (docs/share-previews.md
 * § "The page's metadata"). `image` is the picture's address and `url` the
 * page's own; messaging apps need both absolute, so they're resolved against
 * the site's own address.
 */
export function shareMetadata({
  title,
  description,
  url,
  image,
}: {
  title: string
  description: string
  /** The page's own address, which scrapers ask for as og:url. */
  url: string
  image: string
}): Metadata {
  const { env } = getCloudflareContext()
  const picture = { url: image, ...IMAGE, type: 'image/jpeg', alt: `${title}: date ideas on a starry background` }
  return {
    metadataBase: new URL(env.BETTER_AUTH_URL),
    title,
    description,
    openGraph: { title, description, url, type: 'website', siteName: 'Build-a-Date', images: [picture] },
    twitter: { card: 'summary_large_image', title, description, images: [picture] },
    // Facebook's link debugger asks which app the domain belongs to, but an
    // id has to be made at developers.facebook.com first, so the tag is only
    // given when one is.
    facebook: env.FACEBOOK_APP_ID ? { appId: env.FACEBOOK_APP_ID } : undefined,
  }
}
