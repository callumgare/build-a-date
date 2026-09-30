'use client'

import { useActionState } from 'react'
import { sendSignInLink } from '@/lib/actions/auth'
import Button from '../ui/Button'
import { Field, Form, FormError, FormNote, Input } from '../ui/Form'

type EmailLinkFormProps = {
  askName?: boolean
  submitLabel: string
  // Lets the email field's autofill offer passkeys (see SignInForm).
  offerPasskeys?: boolean
  // Where to land once the link is followed (after Welcome).
  next?: string
}

// Emails a sign-in link: how new accounts are made, and how anyone without a
// passkey to hand signs in.
export default function EmailLinkForm({
  askName = false,
  submitLabel,
  offerPasskeys = false,
  next,
}: EmailLinkFormProps) {
  const [{ sentTo, error, email, name }, formAction, pending] = useActionState(sendSignInLink, {})

  if (sentTo) {
    return (
      <FormNote>
        Check your inbox. We sent a link to <strong>{sentTo}</strong>. It works once and expires in 5 minutes.
      </FormNote>
    )
  }

  return (
    <Form action={formAction}>
      {next && <input type="hidden" name="next" value={next} />}
      {askName && (
        <Field label="Your name">
          <Input name="name" autoComplete="name" required maxLength={80} defaultValue={name} />
        </Field>
      )}
      <Field label="Email">
        <Input
          name="email"
          type="email"
          autoComplete={offerPasskeys ? 'email webauthn' : 'email'}
          required
          defaultValue={email}
        />
      </Field>
      <FormError>{error}</FormError>
      <Button type="submit" disabled={pending}>
        {pending ? 'Sending…' : submitLabel}
      </Button>
    </Form>
  )
}
