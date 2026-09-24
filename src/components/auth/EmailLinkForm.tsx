'use client'

import { useActionState } from 'react'
import { sendSignInLink } from '@/lib/actions/auth'

type EmailLinkFormProps = {
  askName?: boolean
  submitLabel: string
  // Lets the email field's autofill offer passkeys (see SignInForm).
  offerPasskeys?: boolean
}

// Emails a sign-in link: how new accounts are made, and how anyone without a
// passkey to hand signs in.
export default function EmailLinkForm({ askName = false, submitLabel, offerPasskeys = false }: EmailLinkFormProps) {
  const [{ sentTo, error, email, name }, formAction, pending] = useActionState(sendSignInLink, {})

  if (sentTo) {
    return (
      <p className="form-note" role="status">
        Check your inbox. We sent a link to <strong>{sentTo}</strong>. It works once and expires in 5 minutes.
      </p>
    )
  }

  return (
    <form className="form" action={formAction}>
      {askName && (
        <label className="field">
          <span>Your name</span>
          <input name="name" autoComplete="name" required maxLength={80} defaultValue={name} />
        </label>
      )}
      <label className="field">
        <span>Email</span>
        <input
          name="email"
          type="email"
          autoComplete={offerPasskeys ? 'email webauthn' : 'email'}
          required
          defaultValue={email}
        />
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="done-button" type="submit" disabled={pending}>
        {pending ? 'Sending…' : submitLabel}
      </button>
    </form>
  )
}
