import type { ReactNode } from 'react'
import styles from './ItemList.module.css'

// A list of things, one to a line, each with what can be done with it at the
// end of its line.
export function ItemList({ children }: { children: ReactNode }) {
  return <ul className={styles.list}>{children}</ul>
}

export function ItemRow({ children }: { children: ReactNode }) {
  return <li className={styles.row}>{children}</li>
}
