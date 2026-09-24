import 'server-only'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { getDb } from '@/db'
import { createAuth } from './auth-config'

export const getAuth = cache(() => createAuth(getCloudflareContext().env, getDb()))

// Reads the request headers before touching the Cloudflare context, which
// is what marks the page as dynamic rather than prerendered.
export const getSession = cache(async () => {
  const requestHeaders = await headers()
  return getAuth().api.getSession({ headers: requestHeaders })
})

// For pages and actions that only make sense signed in. `next` is where to
// come back to once signed in.
export async function requireUser(next?: string) {
  const session = await getSession()
  if (!session) redirect(next ? `/sign-in?next=${encodeURIComponent(next)}` : '/sign-in')
  return session.user
}
