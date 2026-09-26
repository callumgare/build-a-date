'use client'

import { useActionState } from 'react'
import { updateName } from '@/lib/actions/auth'

// Changes the account's name. A form action, so it works without JavaScript.
export default function NameForm({ name }: { name: string }) {
  const [state, formAction, pending] = useActionState(updateName, {})

  return (
    <form className="form" action={formAction}>
      <label className="field">
        <span>Your name</span>
        <input
          name="name"
          autoComplete="name"
          required
          maxLength={80}
          defaultValue={state.name ?? state.saved ?? name}
        />
      </label>
      {state.error && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}
      {state.saved && (
        <p className="form-note" role="status">
          Saved. You&apos;re now <strong>{state.saved}</strong>.
        </p>
      )}
      <button className="done-button" type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save name'}
      </button>
    </form>
  )
}
