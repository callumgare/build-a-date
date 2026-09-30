'use client'

import { type HTMLMotionProps, motion } from 'motion/react'
import styles from './CardGrid.module.css'

type CardGridProps = HTMLMotionProps<'div'> & {
  // On a wide screen, one card under the next, as in the plan's thin column
  // (docs/card-layout.md § "The plan column").
  stacked?: boolean
}

// The grid of cards, shared by the deck, the rows of the plan, the plan page
// and the deck's edit page, so they all lay cards out the same way
// (docs/card-layout.md § "The grid of cards"). Anything in it marked
// data-full-width takes a line of its own. It's marked data-card-grid, which
// useGridShuffle looks for. A Motion element, so it can take part in layout
// animations.
export default function CardGrid({ stacked = false, className, ...props }: CardGridProps) {
  return (
    <motion.div
      className={`${styles.grid} ${stacked ? styles.stacked : ''} ${className ?? ''}`}
      data-card-grid
      {...props}
    />
  )
}
