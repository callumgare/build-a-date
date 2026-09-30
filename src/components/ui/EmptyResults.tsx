import type { ReactNode } from 'react'
import styles from './EmptyResults.module.css'

// Where a list or grid would be when there's nothing in it: why, and perhaps
// a way to show something after all.
export default function EmptyResults({ message, children }: { message: string; children?: ReactNode }) {
  return (
    <div className={styles.empty}>
      <p>{message}</p>
      {children}
    </div>
  )
}
