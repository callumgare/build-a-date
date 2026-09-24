'use client'

import { type FormEvent, useEffect, useRef, useState, useTransition } from 'react'
import { deleteCard, saveCard } from '@/lib/actions/decks'
import type { DateCard } from '@/types'
import Card from '../Card'
import cardStyles from '../Card.module.css'
import { frameFor } from '../frames'

type CardEditorProps = {
  deckId: string
  // The card being edited, or null to add one. The editor is open whenever
  // this isn't undefined.
  card: DateCard | null | undefined
  deckTags: string[]
  onClose: () => void
}

function parseTags(text: string) {
  return text
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
}

export default function CardEditor({ deckId, card, deckTags, onClose }: CardEditorProps) {
  const dialogReference = useRef<HTMLDialogElement>(null)
  const open = card !== undefined

  useEffect(() => {
    const dialog = dialogReference.current
    if (open && !dialog?.open) dialog?.showModal()
    if (!open && dialog?.open) dialog.close()
  }, [open])

  return (
    <dialog className="share-dialog editor-dialog" ref={dialogReference} onClose={onClose} aria-label="Edit idea">
      {/* Keyed so each opening starts from that card's saved values. */}
      {open && <CardForm key={card?.id ?? 'new'} deckId={deckId} card={card} deckTags={deckTags} onDone={onClose} />}
    </dialog>
  )
}

function CardForm({
  deckId,
  card,
  deckTags,
  onDone,
}: {
  deckId: string
  card: DateCard | null
  deckTags: string[]
  onDone: () => void
}) {
  const [title, setTitle] = useState(card?.title ?? '')
  const [description, setDescription] = useState(card?.description ?? '')
  const [tagText, setTagText] = useState(card?.tags.join(', ') ?? '')
  const [date, setDate] = useState(card?.date ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const tags = parseTags(tagText)
  const preview: DateCard = {
    id: card?.id ?? 'new-card',
    title: title || 'Untitled idea',
    description,
    tags,
    ...(date ? { date } : {}),
  }

  function toggleTag(tag: string) {
    setTagText((tags.includes(tag) ? tags.filter((current) => current !== tag) : [...tags, tag]).join(', '))
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await saveCard(deckId, card?.id ?? null, {
        title,
        description,
        tags,
        date,
      })
      if (result.ok) onDone()
      else setError(result.error)
    })
  }

  function remove() {
    if (!card || !window.confirm(`Delete "${card.title}"?`)) return
    startTransition(async () => {
      const result = await deleteCard(deckId, card.id)
      if (result.ok) onDone()
      else setError(result.error)
    })
  }

  return (
    <form className="editor-layout" onSubmit={submit}>
      <div className="form">
        <h2>{card ? 'Edit idea' : 'New idea'}</h2>
        <label className="field">
          <span>Title</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={80} />
        </label>
        <label className="field">
          <span>
            Description <small>Markdown works, e.g. [More info](https://…)</small>
          </span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            maxLength={1000}
          />
        </label>
        <label className="field">
          <span>
            When <small>Optional, e.g. &ldquo;Fridays until March&rdquo;</small>
          </span>
          <input value={date} onChange={(event) => setDate(event.target.value)} maxLength={80} />
        </label>
        <label className="field">
          <span>
            Tags <small>Separated by commas</small>
          </span>
          <input value={tagText} onChange={(event) => setTagText(event.target.value)} />
        </label>
        {deckTags.length > 0 && (
          <fieldset className="filters tag-picker" aria-label="Tags used in this deck">
            {deckTags.map((tag) => (
              <button
                className="filter-button"
                data-active={tags.includes(tag)}
                aria-pressed={tags.includes(tag)}
                type="button"
                key={tag}
                onClick={() => toggleTag(tag)}
              >
                {tag}
              </button>
            ))}
          </fieldset>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="editor-actions">
          <button className="done-button" type="submit" disabled={pending}>
            {pending ? 'Saving…' : 'Save'}
          </button>
          {card && (
            <button className="text-action" type="button" onClick={remove} disabled={pending}>
              Delete
            </button>
          )}
          <button className="text-action" type="button" onClick={onDone}>
            Cancel
          </button>
        </div>
      </div>

      <div className="editor-preview" aria-hidden="true">
        <div className={cardStyles.card}>
          <Card card={preview} frame={frameFor(preview.id)} />
        </div>
      </div>
    </form>
  )
}
