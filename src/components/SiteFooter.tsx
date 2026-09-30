import type { ReactNode } from 'react'
import styles from './SiteFooter.module.css'

// A line of links at the foot of a page.
export default function SiteFooter({ children }: { children: ReactNode }) {
  return <footer className={styles.footer}>{children}</footer>
}
