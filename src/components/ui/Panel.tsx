import type { ReactNode } from 'react'
import styles from './Panel.module.css'

type PanelProps = {
  // A column in the middle of the page, for a page that's mostly the panel.
  narrow?: boolean
  align?: 'start' | 'center'
  as?: 'section' | 'div'
  className?: string
  children: ReactNode
}

// A box with its own background, for a form or a message on a page
// (docs/ui-components.md § "Surfaces").
export default function Panel({
  narrow = false,
  align = 'start',
  as: Tag = 'section',
  className,
  children,
}: PanelProps) {
  return (
    <Tag
      className={[styles.panel, narrow && styles.narrow, align === 'center' && styles.center, className]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </Tag>
  )
}

// A line at the bottom of a panel, like a link to the other way in.
export function PanelFootnote({ children }: { children: ReactNode }) {
  return <p className={styles.footnote}>{children}</p>
}
