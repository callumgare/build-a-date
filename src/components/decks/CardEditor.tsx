'use client'

import { type FormEvent, useState, useTransition } from 'react'
import { deleteCard, saveCard } from '@/lib/actions/decks'
import type { CardDraft } from '@/lib/quick-add'
import type { DateCard } from '@/types'
import Card from '../Card'
import cardStyles from '../Card.module.css'
import { frameFor } from '../frames'
import Button from '../ui/Button'
import { Chip, ChipGroup } from '../ui/Chip'
import Dialog from '../ui/Dialog'
import { Field, FormActions, FormError, FormStack, Input, TextArea } from '../ui/Form'
import Heading from '../ui/Heading'
import styles from './CardEditor.module.css'

type CardEditorProps = {
  deckId: string
  // The card being edited, or null to add one. The editor is open whenever
  // this isn't undefined.
  card: DateCard | null | undefined
  // What a new card's fields start with, e.g. from Quick Add.
  draft?: CardDraft
  deckTags: string[]
  onClose: () => void
}

function parseTags(text: string) {
  return text
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
}

export default function CardEditor({ deckId, card, draft, deckTags, onClose }: CardEditorProps) {
  const open = card !== undefined

  return (
    <Dialog size="wide" open={open} onClose={onClose} aria-label="Edit idea">
      {/* Keyed so each opening starts from that card's saved values. */}
      {open && (
        <CardForm
          key={card?.id ?? 'new'}
          deckId={deckId}
          card={card}
          draft={draft}
          deckTags={deckTags}
          onDone={onClose}
        />
      )}
    </Dialog>
  )
}

function CardForm({
  deckId,
  card,
  draft,
  deckTags,
  onDone,
}: {
  deckId: string
  card: DateCard | null
  draft?: CardDraft
  deckTags: string[]
  onDone: () => void
}) {
  const initial = card ?? draft
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [tagText, setTagText] = useState(initial?.tags.join(', ') ?? '')
  const [date, setDate] = useState(initial?.date ?? '')
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
    <form className={styles.layout} onSubmit={submit}>
      <FormStack>
        <Heading>{card ? 'Edit idea' : 'New idea'}</Heading>
        <Field label="Title">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={80} />
        </Field>
        <Field label="Description" hint="Markdown works, e.g. [More info](https://…)">
          <TextArea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            maxLength={1000}
          />
        </Field>
        <Field label="When" hint={<>Optional, e.g. &ldquo;Fridays until March&rdquo;</>}>
          <Input value={date} onChange={(event) => setDate(event.target.value)} maxLength={80} />
        </Field>
        <Field label="Tags" hint="Separated by commas">
          <Input value={tagText} onChange={(event) => setTagText(event.target.value)} />
        </Field>
        {deckTags.length > 0 && (
          <ChipGroup name="Tags used in this deck" align="start" className={styles.tagPicker}>
            {deckTags.map((tag) => (
              <Chip pressed={tags.includes(tag)} key={tag} onClick={() => toggleTag(tag)}>
                {tag}
              </Chip>
            ))}
          </ChipGroup>
        )}
        <FormError>{error}</FormError>
        <FormActions>
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving…' : 'Save'}
          </Button>
          {card && (
            <Button variant="text" onClick={remove} disabled={pending}>
              Delete
            </Button>
          )}
          <Button variant="text" onClick={onDone}>
            Cancel
          </Button>
        </FormActions>
      </FormStack>

      <div className={styles.preview} aria-hidden="true">
        <div className={cardStyles.card}>
          <Card card={preview} frame={frameFor(preview.id)} />
        </div>
      </div>
    </form>
  )
}
