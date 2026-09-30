import styles from './Divider.module.css'

// A small spaced-out word, like "or", between two rules. Sized from the text
// around it. Short keeps it to a few words' width rather than the whole line.
export default function Divider({ children, short = false }: { children: string; short?: boolean }) {
  return <span className={`${styles.divider} ${short ? styles.short : ''}`}>{children}</span>
}
