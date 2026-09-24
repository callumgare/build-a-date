'use client'

import { type CSSProperties, type ReactNode, useLayoutEffect, useRef } from 'react'
import Markdown, { type Components } from 'react-markdown'
import type { DateCard as DateCardModel } from '../types'
import styles from './Card.module.css'
import type { Frame } from './frames'

type CardProps = {
  card: DateCardModel
  frame: Frame
  // Buttons shown in the frame's top band, above the text.
  actions?: ReactNode
}

export default function Card({ card, frame, actions }: CardProps) {
  const insets = {
    '--inset-top': frame.inset.top,
    '--inset-bottom': frame.inset.bottom,
    '--inset-side': frame.inset.side,
  } as CSSProperties
  const [contentReference, titleReference] = useFitText(card)

  return (
    <span className={styles.content} ref={contentReference} style={insets} data-frame={frame.name}>
      <FrameArt frame={frame} />
      {/* Before the body, since useFitText measures the last child. */}
      {actions && <span className={styles.actions}>{actions}</span>}
      <span className={styles.body}>
        <span className={styles.title} ref={titleReference}>
          {card.title}
        </span>
        {card.date && <span className={styles.date}>{card.date}</span>}
        <span className={styles.description}>
          <Markdown components={markdownComponents}>{card.description}</Markdown>
        </span>
      </span>
    </span>
  )
}

// Descriptions sit inside a span, so paragraphs render as block spans. Links
// open in a new tab and don't count as a click on the card itself.
const markdownComponents: Components = {
  p: ({ children }) => <span className={styles.paragraph}>{children}</span>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
      {children}
    </a>
  ),
}

// Cards keep a fixed shape, so when the text doesn't fit, step it down until
// it does: first the title, until its longest word fits on a line without
// breaking, then the description and date together, until they fit the card.
function useFitText(card: DateCardModel) {
  const contentReference = useRef<HTMLSpanElement>(null)
  const titleReference = useRef<HTMLSpanElement>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: refits whenever the card's text changes
  useLayoutEffect(() => {
    const content = contentReference.current
    if (!content) return

    // Sub-pixel rects, with the padding scaled to match any layout-animation
    // transform currently applied to the card.
    function overflows() {
      if (!content?.lastElementChild || !content.offsetHeight) return false
      const rect = content.getBoundingClientRect()
      const scale = rect.height / content.offsetHeight
      const limit = rect.bottom - parseFloat(getComputedStyle(content).paddingBottom) * scale
      return content.lastElementChild.getBoundingClientRect().bottom > limit + 0.5
    }

    // Layout widths, which a layout-animation transform doesn't affect.
    function titleOverflows() {
      const title = titleReference.current
      return Boolean(title && title.scrollWidth > title.clientWidth)
    }

    function fit() {
      if (!content) return
      let titleScale = 1
      content.style.removeProperty('--title-fit')
      while (titleOverflows() && titleScale > 0.5) {
        titleScale -= 0.05
        content.style.setProperty('--title-fit', titleScale.toFixed(2))
      }

      let scale = 1
      content.style.removeProperty('--fit')
      while (overflows() && scale > 0.6) {
        scale -= 0.05
        content.style.setProperty('--fit', scale.toFixed(2))
      }
    }

    fit()
    let active = true
    document.fonts.ready.then(() => {
      if (active) fit()
    })
    const observer = new ResizeObserver(fit)
    observer.observe(content)

    return () => {
      active = false
      observer.disconnect()
    }
  }, [card])

  return [contentReference, titleReference] as const
}

function FrameArt({ frame }: { frame: Frame }) {
  return (
    <span className={styles.art} aria-hidden="true">
      <svg viewBox={`0 0 200 ${frame.top.height}`} style={{ aspectRatio: `200 / ${frame.top.height}` }}>
        {frame.top.art}
      </svg>
      <svg className={styles.rails} viewBox="0 0 200 1" preserveAspectRatio="none">
        <path d={frame.rails.map((x) => `M ${x} 0 V 1`).join(' ')} />
      </svg>
      <svg viewBox={`0 0 200 ${frame.bottom.height}`} style={{ aspectRatio: `200 / ${frame.bottom.height}` }}>
        {frame.bottom.art}
      </svg>
    </span>
  )
}
