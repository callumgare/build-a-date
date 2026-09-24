'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { signOut } from '@/lib/actions/auth'
import { authClient } from '@/lib/auth-client'
import type { PasskeySummary } from '@/lib/passkeys'
import AddPasskeyButton from './AddPasskeyButton'

export default function AccountSettings({ passkeys }: { passkeys: PasskeySummary[] }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  async function remove(passkey: PasskeySummary) {
    const lastOne = passkeys.length === 1
    const warning = lastOne
      ? "This is your only passkey. Without it you'll need an email link to sign in. Remove it?"
      : `Remove "${passkey.name ?? 'Unnamed passkey'}"?`
    if (!window.confirm(warning)) return

    setError(null)
    const { error } = await authClient.passkey.deletePasskey({ id: passkey.id })
    if (error) setError(error.message ?? "Couldn't remove the passkey.")
    else router.refresh()
  }

  return (
    <>
      <h3>Passkeys</h3>
      {passkeys.length === 0 ? (
        <p>You don&apos;t have a passkey yet, so you&apos;ll need an email link each time you sign in.</p>
      ) : (
        <>
          <p>Lost a device? Add a passkey on this one, then remove the old one.</p>
          <ul className="passkey-list">
            {passkeys.map((passkey) => (
              <li key={passkey.id}>
                <span>
                  {passkey.name ?? 'Unnamed passkey'}
                  {passkey.createdAt && (
                    <small suppressHydrationWarning>
                      {' '}
                      · created {new Date(passkey.createdAt).toLocaleDateString()}
                    </small>
                  )}
                </span>
                <button className="text-action" type="button" onClick={() => remove(passkey)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form">
        <AddPasskeyButton label="Add a passkey" onAdded={() => router.refresh()} />
      </div>

      <hr />
      <form action={signOut}>
        <button className="text-action" type="submit">
          Sign out
        </button>
      </form>
    </>
  )
}
