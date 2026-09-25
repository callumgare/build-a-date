'use client'

import { type FormEvent, useEffect, useRef, useState, useTransition } from 'react'
import { quickAddCard } from '@/lib/actions/decks'
import type { CardDraft } from '@/lib/quick-add'

type QuickAddProps = {
  deckId: string
  open: boolean
  onClose: () => void
  // Called with the details read from what was typed, for the card form.
  onDraft: (draft: CardDraft) => void
}

export default function QuickAdd({ deckId, open, onClose, onDraft }: QuickAddProps) {
  const dialogReference = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogReference.current
    if (open && !dialog?.open) dialog?.showModal()
    if (!open && dialog?.open) dialog.close()
  }, [open])

  return (
    <dialog className="share-dialog quick-add-dialog" ref={dialogReference} onClose={onClose} aria-label="Quick Add">
      {/* Only mounted while open, so each opening starts empty. */}
      {open && <QuickAddForm deckId={deckId} onCancel={onClose} onDraft={onDraft} />}
    </dialog>
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
    <form className="form" onSubmit={submit}>
      <h2>Quick Add</h2>
      <label className="field">
        <span>
          Describe the idea <small>A name, a link, or both</small>
        </span>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={5}
          maxLength={2000}
          required
          disabled={pending}
          placeholder="Boat hire at Fairfield Boathouse, open on Wednesdays https://…"
          // biome-ignore lint/a11y/noAutofocus: the field the Quick Add button just opened
          autoFocus
        />
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="editor-actions">
        <button className="done-button" type="submit" disabled={pending}>
          {pending ? 'Filling in…' : 'Fill in the details'}
        </button>
        <button className="text-action" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
