import type { ReactNode, Ref } from 'react'
import styles from './BuilderColumn.module.css'

type BuilderColumnProps = {
  column: 'deck' | 'plan'
  // Shrunk on a narrow screen while the other column is in use
  // (docs/card-layout.md § "Narrow screens").
  shrunk: boolean
  // Anything pressed or focused in it.
  onUse: () => void
  // The switch over it while it's shrunk, which puts it in use.
  switchLabel: string
  onSwitch: () => void
  className?: string
  ref?: Ref<HTMLDivElement>
  children: ReactNode
}

// One of the builder's two columns: the deck, or the plan. Marked
// data-column, which the builder's layout reads.
export default function BuilderColumn({
  column,
  shrunk,
  onUse,
  switchLabel,
  onSwitch,
  className,
  ref,
  children,
}: BuilderColumnProps) {
  return (
    <div
      className={`${styles.column} ${className ?? ''}`}
      data-column={column}
      data-shrunk={shrunk}
      ref={ref}
      onPointerDownCapture={onUse}
      onFocusCapture={onUse}
    >
      {children}
      {/* Covers a shrunk column, so a click anywhere on it puts it in use
          rather than doing what's under it. */}
      {shrunk && <button className={styles.switch} type="button" aria-label={switchLabel} onClick={onSwitch} />}
    </div>
  )
}
