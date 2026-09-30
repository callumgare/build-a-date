import type { ReactNode } from 'react'
import styles from './Muted.module.css'

// Text that steps back from what's around it.
export default function Muted({ as: Tag = 'span', children }: { as?: 'span' | 'p' | 'small'; children: ReactNode }) {
  return <Tag className={styles.muted}>{children}</Tag>
}
