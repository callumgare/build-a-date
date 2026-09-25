'use client'

import { useState } from 'react'
import type { CardDraft } from '@/lib/quick-add'
import type { DateCard } from '@/types'
import CardEditor from './CardEditor'
import QuickAdd from './QuickAdd'

// The card form and Quick Add, wired together so what Quick Add reads opens
// in the form (docs/quick-add.md). Shared by the deck's edit page and the
// shared deck. Without a deck id there's nothing to edit, and no dialogs.
export function useCardEditor(deckId: string | undefined, deckTags: string[]) {
  // undefined: closed, null: adding a card.
  const [editing, setEditing] = useState<DateCard | null | undefined>(undefined)
  const [quickAdding, setQuickAdding] = useState(false)
  // What Quick Add read, for the new card's form to start with.
  const [draft, setDraft] = useState<CardDraft | undefined>(undefined)

  const dialogs = deckId && (
    <>
      <QuickAdd
        deckId={deckId}
        open={quickAdding}
        onClose={() => setQuickAdding(false)}
        onDraft={(read) => {
          setQuickAdding(false)
          setDraft(read)
          setEditing(null)
        }}
      />
      <CardEditor
        deckId={deckId}
        card={editing}
        draft={draft}
        deckTags={deckTags}
        onClose={() => {
          setEditing(undefined)
          setDraft(undefined)
        }}
      />
    </>
  )

  return {
    editCard: (card: DateCard) => setEditing(card),
    addCard: () => setEditing(null),
    quickAdd: () => setQuickAdding(true),
    dialogs,
  }
}
