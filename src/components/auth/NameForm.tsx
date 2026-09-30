'use client'

import { useActionState } from 'react'
import { updateName } from '@/lib/actions/auth'
import Button from '../ui/Button'
import { Field, Form, FormError, FormNote, Input } from '../ui/Form'

// Changes the account's name. A form action, so it works without JavaScript.
export default function NameForm({ name }: { name: string }) {
  const [state, formAction, pending] = useActionState(updateName, {})

  return (
    <Form action={formAction}>
      <Field label="Your name">
        <Input
          name="name"
          autoComplete="name"
          required
          maxLength={80}
          defaultValue={state.name ?? state.saved ?? name}
        />
      </Field>
      <FormError>{state.error}</FormError>
      {state.saved && (
        <FormNote>
          Saved. You&apos;re now <strong>{state.saved}</strong>.
        </FormNote>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save name'}
      </Button>
    </Form>
  )
}
