import type { ReactNode } from 'react'
import styles from './PlanBar.module.css'

// The line under a plan's title with what can be done with it: Save plan and
// Clear plan in the builder (docs/card-layout.md § "Save plan and Clear
// plan"), Share and Edit plan on the plan page. The plan page lays it out as
// the builder does, so the title, the words under it and the buttons are
// spaced the same as when editing the plan.
export function PlanBar({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`${styles.bar} ${className ?? ''}`} data-plan-bar>
      {children}
    </div>
  )
}

// The buttons, side by side, with room between them.
export function PlanActions({ children }: { children: ReactNode }) {
  return (
    <div className={styles.actions} data-plan-actions>
      {children}
    </div>
  )
}
