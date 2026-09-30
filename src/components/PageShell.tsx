import type { ReactNode } from 'react'
import styles from './PageShell.module.css'

// The column every page is laid out in, with the scattered stars behind it.
export default function PageShell({ children }: { children: ReactNode }) {
  return (
    <main className={styles.shell}>
      <Stars />
      {children}
    </main>
  )
}

const stars = [styles.star1, styles.star2, styles.star3, styles.star4, styles.star5, styles.star6, styles.star7]

function Stars() {
  return (
    <div className={styles.stars} data-stars aria-hidden="true">
      {stars.map((className, index) => (
        // biome-ignore lint/performance/noImgElement: small decorative SVGs, nothing for next/image to optimise
        <img key={className} className={`${styles.star} ${className}`} src={`/star-${index + 1}.svg`} alt="" />
      ))}
    </div>
  )
}
