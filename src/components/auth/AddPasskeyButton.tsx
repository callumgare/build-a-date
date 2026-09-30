'use client'

import { useState } from 'react'
import { authClient, passkeyName, wasCancelled } from '@/lib/auth-client'
import Button from '../ui/Button'
import { FormError } from '../ui/Form'

type AddPasskeyButtonProps = {
  label?: string
  onAdded: () => void
}

// Browsers only create a passkey from a click, so there's always a button.
export default function AddPasskeyButton({ label = 'Create a passkey', onAdded }: AddPasskeyButtonProps) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function add() {
    setPending(true)
    setError(null)
    const { error } = await authClient.passkey.addPasskey({
      name: passkeyName(),
    })
    setPending(false)
    if (!error) onAdded()
    else if (!wasCancelled(error)) {
      setError(error.message ?? "Couldn't create the passkey.")
    }
  }

  return (
    <>
      <Button onClick={add} disabled={pending}>
        {pending ? 'Waiting for your device…' : label}
      </Button>
      <FormError>{error}</FormError>
    </>
  )
}
