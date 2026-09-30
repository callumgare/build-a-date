'use client'

import { type HTMLMotionProps, motion } from 'motion/react'
import type { ReactNode } from 'react'
import styles from './PlanGroup.module.css'
import Button from './ui/Button'

// A group in a plan: a row of its own under the plan's first row, with its
// title and notes above its cards (docs/plans.md § "Groups").

// On the plan page: the title and notes centred over the group's cards, and
// further from the cards above than from their own, so they read as the
// group's.
export function PlanGroupSection({ title, notes, children }: { title: string; notes: string; children: ReactNode }) {
  return (
    <section className={`${styles.group} ${styles.page}`} aria-label={title || 'A group'}>
      {(title || notes) && (
        <div className={styles.info}>
          {title && <h2 className={styles.title}>{title}</h2>}
          {notes && <p className={styles.text}>{notes}</p>}
        </div>
      )}
      {children}
    </section>
  )
}

type PlanGroupEditorProps = Omit<HTMLMotionProps<'section'>, 'title' | 'children' | 'onChange'> & {
  id: string
  // What the group is called when it has no title yet.
  name: string
  placeholder: string
  title: string
  notes: string
  onChange: (change: { title?: string; notes?: string }) => void
  onRemove: () => void
  children: ReactNode
}

// In the builder's column: the title and notes are fields that look like the
// text they'll be, centred above the cards with Remove group under them, as
// the column is too thin to put anything beside them. A Motion element, so it
// slides as the rows above it grow or shrink.
export function PlanGroupEditor({
  id,
  name,
  placeholder,
  title,
  notes,
  onChange,
  onRemove,
  children,
  ...motionProps
}: PlanGroupEditorProps) {
  return (
    <motion.section
      className={`${styles.group} ${styles.builder}`}
      data-group-id={id}
      aria-label={name}
      {...motionProps}
    >
      <div className={styles.info}>
        <input
          className={`${styles.title} ${styles.field}`}
          type="text"
          aria-label={`Title of ${name}`}
          placeholder={placeholder}
          maxLength={80}
          value={title}
          onChange={(event) => onChange({ title: event.target.value })}
        />
        <textarea
          className={`${styles.text} ${styles.field} ${styles.notes}`}
          aria-label={`Notes on ${name}`}
          placeholder="Notes"
          rows={1}
          maxLength={2000}
          value={notes}
          onChange={(event) => onChange({ notes: event.target.value })}
        />
        <Button variant="text" className={styles.remove} aria-label={`Remove ${name}`} onClick={onRemove}>
          Remove group
        </Button>
      </div>
      {children}
    </motion.section>
  )
}

// The class for a group's row of cards, which sits a little apart from its
// title and notes.
export const groupTrack = styles.track
