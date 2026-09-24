'use server'

import { isAPIError } from 'better-auth/api'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { getAuth } from '../auth'
import { safeNextPath } from '../validation'

// On an error, what was typed comes back too, since React resets the form.
export type SignInLinkState = { sentTo?: string; error?: string; email?: string; name?: string }

const signInLinkInput = z.object({
  email: z.email('Enter a valid email address').trim(),
  name: z.string().trim().max(80).optional(),
})

// Sends a magic link, which signs someone in (or up, for a new address). A
// server action rather than a client call, so the form works as soon as the
// page arrives, before (or without) its JavaScript.
export async function sendSignInLink(_state: SignInLinkState, form: FormData): Promise<SignInLinkState> {
  const typed = { email: String(form.get('email') ?? ''), name: String(form.get('name') ?? '') }
  const parsed = signInLinkInput.safeParse({
    email: typed.email,
    name: typed.name || undefined,
  })
  if (!parsed.success) return { ...typed, error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' }
  const { email, name } = parsed.data
  // Where they were headed before being asked to sign in, if anywhere.
  const next = safeNextPath(form.get('next'))
  const carry = next ? `next=${encodeURIComponent(next)}` : ''

  try {
    await getAuth().api.signInMagicLink({
      body: {
        email,
        ...(name ? { name } : {}),
        // Welcome sends people with a passkey on to their decks, and offers
        // one to anyone without (new, skipped it, or lost it).
        callbackURL: carry ? `/welcome?${carry}` : '/welcome',
        errorCallbackURL: carry ? `/sign-in?error=link&${carry}` : '/sign-in?error=link',
      },
      headers: await headers(),
    })
  } catch (error) {
    // Better Auth's own refusals (rate limits, say) have a message worth
    // showing. Anything else, like Resend rejecting the email, is logged.
    if (isAPIError(error) && error.message) return { ...typed, error: error.message }
    console.error("Couldn't send a sign-in link", error)
    return { ...typed, error: "Couldn't send the email. Try again in a minute." }
  }
  return { sentTo: email }
}

// A form action rather than a client call, like sendSignInLink, so signing
// out doesn't depend on the page's JavaScript having loaded.
export async function signOut() {
  try {
    await getAuth().api.signOut({ headers: await headers() })
  } catch (error) {
    // Already signed out (say, in another tab) is fine.
    if (!isAPIError(error)) throw error
  }
  redirect('/')
}
