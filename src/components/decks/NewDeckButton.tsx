'use client'

import { type FormEvent, useRef, useState, useTransition } from 'react'
import { createDeck } from '@/lib/actions/decks'

export default function NewDeckButton({ label = 'New deck' }: { label?: string }) {
  const dialogReference = useRef<HTMLDialogElement>(null)
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
      <button className="done-button" type="button" onClick={() => dialogReference.current?.showModal()}>
        {label}
      </button>
      <dialog className="share-dialog form-dialog" ref={dialogReference} aria-labelledby="new-deck-title">
        <form className="form" onSubmit={submit}>
          <h2 id="new-deck-title">New deck</h2>
          <label className="field">
            <span>Name</span>
            <input name="name" required maxLength={80} placeholder="Date ideas for Sam" />
          </label>
          <fieldset className="choice-group">
            <legend>Start with</legend>
            <label className="choice">
              <input type="radio" name="template" value="suggestions" defaultChecked />
              <span>
                <strong>Suggestions</strong>
                <small>About 30 ideas that work anywhere, to edit or delete as you like</small>
              </span>
            </label>
            <label className="choice">
              <input type="radio" name="template" value="empty" />
              <span>
                <strong>An empty deck</strong>
                <small>Add every idea yourself</small>
              </span>
            </label>
          </fieldset>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="done-button" type="submit" disabled={pending}>
            {pending ? 'Creating…' : 'Create deck'}
          </button>
          <button className="text-action" type="button" onClick={() => dialogReference.current?.close()}>
            Cancel
          </button>
        </form>
      </dialog>
    </>
  )
}
