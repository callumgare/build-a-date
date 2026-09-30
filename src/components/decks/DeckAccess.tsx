'use client'

import { useState, useTransition } from 'react'
import { removeEditor, respondToAccessRequest } from '@/lib/actions/decks'
import type { ActionResult } from '@/lib/actions/result'
import Button from '../ui/Button'
import { FormError } from '../ui/Form'
import { Subheading } from '../ui/Heading'
import { ItemList, ItemRow } from '../ui/ItemList'
import Muted from '../ui/Muted'
import { SectionActions } from '../ui/PageSection'

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

  const errorMessage = <FormError>{error}</FormError>
  return { run, pending, errorMessage }
}

function Person({ person }: { person: DeckPerson }) {
  return (
    <span>
      {person.name || person.email}
      {person.name && <Muted as="small"> · {person.email}</Muted>}
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
      <Subheading count={requests.length}>Asking to edit</Subheading>
      <ItemList>
        {requests.map((person) => (
          <ItemRow key={person.userId}>
            <Person person={person} />
            <SectionActions as="span">
              <Button
                disabled={pending}
                onClick={() => run(() => respondToAccessRequest(deckId, person.userId, true))}
                aria-label={`Accept ${person.name || person.email}`}
              >
                Accept
              </Button>
              <Button
                variant="text"
                disabled={pending}
                onClick={() => run(() => respondToAccessRequest(deckId, person.userId, false))}
                aria-label={`Decline ${person.name || person.email}`}
              >
                Decline
              </Button>
            </SectionActions>
          </ItemRow>
        ))}
      </ItemList>
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
      <Subheading count={editors.length}>Editors</Subheading>
      {editors.length === 0 ? (
        <Muted as="p">
          Anyone with the share link can ask to help edit this deck. You&apos;ll get an email, and can say yes or no
          here.
        </Muted>
      ) : (
        <ItemList>
          {editors.map((person) => (
            <ItemRow key={person.userId}>
              <Person person={person} />
              <Button
                variant="text"
                disabled={pending}
                onClick={() => remove(person)}
                aria-label={`Remove ${person.name || person.email}`}
              >
                Remove
              </Button>
            </ItemRow>
          ))}
        </ItemList>
      )}
      {errorMessage}
    </section>
  )
}
