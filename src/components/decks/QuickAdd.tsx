'use client'

import { type FormEvent, useState, useTransition } from 'react'
import { quickAddCard } from '@/lib/actions/decks'
import type { CardDraft } from '@/lib/quick-add'
import Button from '../ui/Button'
import Dialog from '../ui/Dialog'
import { Field, Form, FormActions, FormError, TextArea } from '../ui/Form'
import Heading from '../ui/Heading'

type QuickAddProps = {
  deckId: string
  open: boolean
  onClose: () => void
  // Called with the details read from what was typed, for the card form.
  onDraft: (draft: CardDraft) => void
}

export default function QuickAdd({ deckId, open, onClose, onDraft }: QuickAddProps) {
  return (
    <Dialog size="form" open={open} onClose={onClose} aria-label="Quick Add">
      {/* Only mounted while open, so each opening starts empty. */}
      {open && <QuickAddForm deckId={deckId} onCancel={onClose} onDraft={onDraft} />}
    </Dialog>
  )
}

function QuickAddForm({
  deckId,
  onCancel,
  onDraft,
}: {
  deckId: string
  onCancel: () => void
  onDraft: (draft: CardDraft) => void
}) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await quickAddCard(deckId, text)
      if (result.ok) onDraft(result.data)
      else setError(result.error)
    })
  }

  return (
    <Form onSubmit={submit}>
      <Heading>Quick Add</Heading>
      <Field label="Describe the idea" hint="A name, a link, or both">
        <TextArea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={5}
          maxLength={2000}
          required
          disabled={pending}
          placeholder="Boat hire at Fairfield Boathouse, open on Wednesdays https://…"
          // Focused: the field the Quick Add button just opened.
          autoFocus
        />
      </Field>
      <FormError>{error}</FormError>
      <FormActions>
        <Button type="submit" disabled={pending}>
          {pending ? 'Filling in…' : 'Fill in the details'}
        </Button>
        <Button variant="text" onClick={onCancel}>
          Cancel
        </Button>
      </FormActions>
    </Form>
  )
}
