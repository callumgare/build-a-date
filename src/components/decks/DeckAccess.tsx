'use client'

import { useState, useTransition } from 'react'
import { removeEditor, respondToAccessRequest } from '@/lib/actions/decks'
import type { ActionResult } from '@/lib/actions/result'

export type DeckPerson = {
  userId: string
  name: string
  email: string
  status: 'pending' | 'accepted'
}

function useAccessAction() {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function run(action: () => Promise<ActionResult>) {
    setError(null)
    startTransition(async () => {
      const result = await action()
      if (!result.ok) setError(result.error)
    })
  }

  const errorMessage = error && (
    <p className="form-error" role="alert">
      {error}
    </p>
  )
  return { run, pending, errorMessage }
}

function Person({ person }: { person: DeckPerson }) {
  return (
    <span>
      {person.name || person.email}
      {person.name && <small className="muted"> · {person.email}</small>}
    </span>
  )
}

// People asking to edit, for the owner to let in or turn away. Shown near the
// top, since the owner's email about a request links straight here.
export function AccessRequests({ deckId, people }: { deckId: string; people: DeckPerson[] }) {
  const { run, pending, errorMessage } = useAccessAction()
  const requests = people.filter((person) => person.status === 'pending')
  if (requests.length === 0) return null

  return (
    <section aria-label="Edit requests">
      <h3 className="subheading">
        Asking to edit <small>({requests.length})</small>
      </h3>
      <ul className="plan-list">
        {requests.map((person) => (
          <li key={person.userId}>
            <Person person={person} />
            <span className="section-actions">
              <button
                className="done-button"
                type="button"
                disabled={pending}
                onClick={() => run(() => respondToAccessRequest(deckId, person.userId, true))}
                aria-label={`Accept ${person.name || person.email}`}
              >
                Accept
              </button>
              <button
                className="text-action"
                type="button"
                disabled={pending}
                onClick={() => run(() => respondToAccessRequest(deckId, person.userId, false))}
                aria-label={`Decline ${person.name || person.email}`}
              >
                Decline
              </button>
            </span>
          </li>
        ))}
      </ul>
      {errorMessage}
    </section>
  )
}

export function Editors({ deckId, people }: { deckId: string; people: DeckPerson[] }) {
  const { run, pending, errorMessage } = useAccessAction()
  const editors = people.filter((person) => person.status === 'accepted')

  function remove(person: DeckPerson) {
    if (!window.confirm(`Stop ${person.name || person.email} editing this deck?`)) return
    run(() => removeEditor(deckId, person.userId))
  }

  return (
    <section aria-label="Editors">
      <h3 className="subheading">
        Editors <small>({editors.length})</small>
      </h3>
      {editors.length === 0 ? (
        <p className="muted">
          Anyone with the share link can ask to help edit this deck. You&apos;ll get an email, and can say yes or no
          here.
        </p>
      ) : (
        <ul className="plan-list">
          {editors.map((person) => (
            <li key={person.userId}>
              <Person person={person} />
              <button
                className="text-action"
                type="button"
                disabled={pending}
                onClick={() => remove(person)}
                aria-label={`Remove ${person.name || person.email}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {errorMessage}
    </section>
  )
}
