'use client'

import { type HTMLMotionProps, motion } from 'motion/react'
import styles from './EmptySlot.module.css'

type EmptySlotProps = HTMLMotionProps<'div'> & {
  // Only as tall as what's in it, rather than a card's height.
  compact?: boolean
}

// A dashed outline where a card could go. A Motion element, so it can slide
// along with the cards around it.
export default function EmptySlot({ compact = false, className, ...props }: EmptySlotProps) {
  return (
    <motion.div
      data-empty-slot
      className={`${styles.slot} ${compact ? styles.compact : ''} ${className ?? ''}`}
      {...props}
    />
  )
}
