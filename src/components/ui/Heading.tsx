import type { ReactNode } from 'react'
import styles from './Heading.module.css'

type HeadingProps = {
  level?: 2 | 3
  // Section is a page's own heading, beside its actions; panel heads a panel
  // or dialog.
  size?: 'section' | 'panel'
  id?: string
  className?: string
  children: ReactNode
}

// A heading in the display face.
export default function Heading({ level = 2, size = 'panel', id, className, children }: HeadingProps) {
  const Tag = `h${level}` as const
  return (
    <Tag className={`${styles.heading} ${styles[size]} ${className ?? ''}`} id={id}>
      {children}
    </Tag>
  )
}

// A smaller heading over part of a page, with how many things are under it
// when there's a count.
export function Subheading({ count, children }: { count?: number; children: ReactNode }) {
  return (
    <h3 className={styles.subheading}>
      {children}
      {count !== undefined && (
        <>
          {' '}
          <small>({count})</small>
        </>
      )}
    </h3>
  )
}
