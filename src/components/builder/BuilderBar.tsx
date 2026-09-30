'use client'

import { AnimatePresence, motion, useIsPresent } from 'motion/react'
import type { ReactNode } from 'react'
import { PlanBar } from '../PlanBar'
import { FormError } from '../ui/Form'
import styles from './BuilderBar.module.css'

type BuilderBarProps = {
  // Whether there's a plan to act on yet. Until there is, it says how to
  // start one.
  showActions: boolean
  reduceMotion: boolean
  error: string | null
  className?: string
  // The plan's buttons (PlanActions).
  children: ReactNode
}

// Save plan and Clear plan, above both columns (docs/card-layout.md § "Save
// plan and Clear plan"). Always laid out, so the first pick doesn't push the
// page down.
export default function BuilderBar({ showActions, reduceMotion, error, className, children }: BuilderBarProps) {
  return (
    <PlanBar className={className}>
      {/* One fades out as the other fades in, in the same place. */}
      <div className={styles.swap}>
        <AnimatePresence initial={false}>
          {showActions ? (
            <BarFade key="actions" reduceMotion={reduceMotion}>
              {children}
            </BarFade>
          ) : (
            <BarFade key="prompt" reduceMotion={reduceMotion}>
              <p className={styles.prompt} data-plan-prompt>
                Pick a card from the deck
              </p>
            </BarFade>
          )}
        </AnimatePresence>
      </div>
      <FormError>{error}</FormError>
    </PlanBar>
  )
}

const instant = { duration: 0 }

// The bar's prompt, or its buttons, fading in and out. Nothing fading out
// can be pressed.
function BarFade({ reduceMotion, children }: { reduceMotion: boolean; children: ReactNode }) {
  const present = useIsPresent()
  return (
    <motion.div
      className={styles.content}
      data-bar-content
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={reduceMotion ? instant : { duration: 0.25, ease: 'easeOut' }}
      inert={!present}
    >
      {children}
    </motion.div>
  )
}

// On the sample deck, in place of Save plan: where Make your own deck goes
// from the home page (docs/sample-deck.md § "What's different").
export function SampleSave({ children }: { children: ReactNode }) {
  return <span className={styles.sampleSave}>{children}</span>
}
