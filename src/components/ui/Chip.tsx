import type { ReactNode } from 'react'
import styles from './Chip.module.css'

type ChipGroupProps = {
  // What the group is for, read out by screen readers.
  name: string
  // Shown in front of the chips, as plain text so it doesn't read as one.
  label?: string
  align?: 'center' | 'start'
  className?: string
  children: ReactNode
}

// A row of chips that wraps, like the deck's filters.
export function ChipGroup({ name, label, align = 'center', className, children }: ChipGroupProps) {
  return (
    <fieldset
      className={`${styles.group} ${align === 'start' ? styles.start : ''} ${className ?? ''}`}
      aria-label={name}
    >
      {label && <span className={styles.label}>{label}</span>}
      {children}
    </fieldset>
  )
}

type ChipProps = {
  pressed: boolean
  onClick: () => void
  className?: string
  children: ReactNode
}

// A button that's on or off, filled with the accent while it's on.
export function Chip({ pressed, onClick, className, children }: ChipProps) {
  return (
    <button className={`${styles.chip} ${className ?? ''}`} type="button" aria-pressed={pressed} onClick={onClick}>
      {children}
    </button>
  )
}
