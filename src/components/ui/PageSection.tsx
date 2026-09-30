import type { ReactNode } from 'react'
import styles from './PageSection.module.css'

// The main part of one of the app's own pages, like the deck list or a deck's
// edit page. A container, so a grid of cards inside it works out its columns
// from its width (docs/card-layout.md § "The grid of cards").
export function PageSection({ children }: { children: ReactNode }) {
  return <section className={styles.section}>{children}</section>
}

// The page's heading, with what can be done on the page beside it.
export function SectionHeading({ children }: { children: ReactNode }) {
  return <div className={styles.heading}>{children}</div>
}

// A few buttons or links side by side.
export function SectionActions({ as: Tag = 'div', children }: { as?: 'div' | 'span'; children: ReactNode }) {
  return <Tag className={styles.actions}>{children}</Tag>
}
