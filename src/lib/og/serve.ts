// A kept picture as a response (docs/share-previews.md § "Storing and
// serving"). Pages link to it with ?v=<key>, so an address always means the
// same picture and can be cached for good. Any other address might mean an
// older picture, so it's only cached briefly.
export function previewResponse(found: { key: string; image: Uint8Array } | null, request: Request) {
  if (!found) return new Response('Not found', { status: 404 })
  const current = new URL(request.url).searchParams.get('v') === found.key
  return new Response(new Uint8Array(found.image), {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': current ? 'public, max-age=31536000, immutable' : 'public, max-age=300',
    },
  })
}

/** The address a page gives messaging apps for its picture. */
export function previewAddress(path: string, stored: string | null) {
  return stored ? `${path}?v=${stored}` : DEFAULT_PREVIEW
}

/** For a deck or plan whose picture hasn't been drawn yet. */
export const DEFAULT_PREVIEW = '/og/default.jpg'
