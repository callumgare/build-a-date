'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { authClient, wasCancelled } from '@/lib/auth-client'
import Button from '../ui/Button'
import Divider from '../ui/Divider'
import { FormError, FormStack } from '../ui/Form'
import EmailLinkForm from './EmailLinkForm'

export default function SignInForm({ linkFailed = false, next }: { linkFailed?: boolean; next?: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(
    linkFailed ? 'That sign-in link has expired or was already used. Request a new one below.' : null,
  )

  function signedIn() {
    router.push(next ?? '/decks')
    router.refresh()
  }

  // Where the browser supports it, the email field offers saved passkeys in
  // its autofill too, in case someone reaches for their email out of habit.
  // Off localhost over http there is no PublicKeyCredential at all.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once; signedIn only uses the stable router and next, a prop from the URL
  useEffect(() => {
    let active = true
    window.PublicKeyCredential?.isConditionalMediationAvailable?.().then(async (available) => {
      if (!available || !active) return
      const { data } = await authClient.signIn.passkey({ autoFill: true })
      if (data && active) signedIn()
    })
    return () => {
      active = false
    }
  }, [])

  async function signInWithPasskey() {
    setError(null)
    const { data, error } = await authClient.signIn.passkey()
    if (data) signedIn()
    else if (error && !wasCancelled(error)) {
      setError(error.message ?? "That passkey didn't work.")
    }
  }

  return (
    <FormStack>
      <Button onClick={signInWithPasskey}>Sign in with a passkey</Button>
      <FormError>{error}</FormError>

      <Divider>or</Divider>

      {/* For anyone who skipped making a passkey, or lost theirs. */}
      <EmailLinkForm submitLabel="Email me a sign-in link" offerPasskeys next={next} />
    </FormStack>
  )
}
