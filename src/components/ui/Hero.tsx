import type { ReactNode } from 'react'
import styles from './Hero.module.css'

// A page's big title, with anything under it (like Editing a plan) centred
// below it. It's marked data-hero, which the site header and the stars look
// for (docs/ui-components.md § "Page frame").
export default function Hero({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className={styles.hero} data-hero>
      <h1 className={styles.title}>{title}</h1>
      {children}
    </header>
  )
}

// A line or two of larger text introducing the page.
export function Lede({ children }: { children: ReactNode }) {
  return <p className={styles.lede}>{children}</p>
}
