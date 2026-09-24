import { getCloudflareContext } from '@opennextjs/cloudflare'
import { devOutbox, usesOutbox } from '@/lib/email'

// Lets e2e tests read the sign-in emails that weren't really sent. Only
// exists when the outbox is standing in for Resend (see usesOutbox).
export function GET(request: Request) {
  if (!usesOutbox(getCloudflareContext().env)) return new Response('Not found', { status: 404 })
  const to = new URL(request.url).searchParams.get('to')
  return Response.json(devOutbox.filter((email) => !to || email.to === to))
}
