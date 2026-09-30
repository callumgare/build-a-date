'use client'

import { type FormEvent, useState, useTransition } from 'react'
import { createDeck } from '@/lib/actions/decks'
import Button from '../ui/Button'
import Dialog from '../ui/Dialog'
import { Choice, ChoiceGroup, Field, Form, FormError, Input } from '../ui/Form'
import Heading from '../ui/Heading'

export default function NewDeckButton({ label = 'New deck' }: { label?: string }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name'))
    const template = form.get('template') === 'empty' ? 'empty' : 'suggestions'

    setError(null)
    startTransition(async () => {
      // Redirects to the new deck on success.
      const result = await createDeck({ name, template })
      if (!result.ok) setError(result.error)
    })
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>{label}</Button>
      <Dialog size="form" open={open} onClose={() => setOpen(false)} aria-labelledby="new-deck-title">
        <Form onSubmit={submit}>
          <Heading id="new-deck-title">New deck</Heading>
          <Field label="Name">
            <Input name="name" required maxLength={80} placeholder="Date ideas for Sam" />
          </Field>
          <ChoiceGroup legend="Start with">
            <Choice
              name="template"
              value="suggestions"
              defaultChecked
              title="Suggestions"
              hint="About 30 ideas that work anywhere, to edit or delete as you like"
            />
            <Choice name="template" value="empty" title="An empty deck" hint="Add every idea yourself" />
          </ChoiceGroup>
          <FormError>{error}</FormError>
          <Button type="submit" disabled={pending}>
            {pending ? 'Creating…' : 'Create deck'}
          </Button>
          <Button variant="text" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </Form>
      </Dialog>
    </>
  )
}
