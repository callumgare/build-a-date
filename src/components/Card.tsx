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
  // The card's rating and notes, jotted in its corner. Only for shared decks
  // (docs/card-notes.md § "Rating and notes").
  scrawl?: Scrawled
}

type Scrawled = { interest: number | null; notes: string }

export default function Card({ card, frame, actions, scrawl }: CardProps) {
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
      {scrawl && <Scrawl {...scrawl} />}
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

// A hand-drawn star with the rating beside it, and a few lines of
// scribble when there are notes, as if pencilled into the corner
// (docs/card-notes.md § "Rating and notes on the card").
function Scrawl({ interest, notes }: Scrawled) {
  const digit = interest && digits[interest - 1]
  const hasNotes = notes.trim() !== ''
  if (!digit && !hasNotes) return null

  const marks: { name: string; width: number; paths: string[] }[] = []
  if (digit) marks.push({ name: 'star', width: 24, paths: [star] }, { name: 'rating', width: 14, paths: digit })
  if (hasNotes) marks.push({ name: 'notes', width: 28, paths: scribbles })

  return (
    <span className={styles.scrawl}>
      <span className="visually-hidden">
        {[digit && `Rated ${interest} out of 5.`, hasNotes && 'Has notes.'].filter(Boolean).join(' ')}
      </span>
      {marks.map((mark) => (
        <svg key={mark.name} data-mark={mark.name} viewBox={`0 0 ${mark.width} 24`} aria-hidden="true">
          {/* A wide stroke in the card's colour first, so frame lines under
              the ink fade out behind it. */}
          <g className={styles.scrawlPaper}>
            {mark.paths.map((d) => (
              <path key={d} d={d} />
            ))}
          </g>
          <g className={styles.scrawlInk}>
            {mark.paths.map((d) => (
              <path key={d} d={d} />
            ))}
          </g>
        </svg>
      ))}
    </span>
  )
}

// Drawn freehand on a 24-unit-tall canvas: wobbly, with the star overshooting
// where it started.
const star =
  'M 11.5 2.8 Q 13.4 5.5 14.8 8.7 Q 18.4 8.6 21.8 9.4 Q 19 11.4 16.2 13.7 Q 17.6 17 18.3 20.5 Q 15.1 18.6 12.2 16.5 Q 9 18.4 5.9 19.9 Q 6.6 16.4 7.7 13.1 Q 4.8 11 2.3 8.5 Q 5.8 8.3 9.3 8.1 Q 10.6 4.6 12.6 1.7'

const digits = [
  ['M 3 7 Q 5.5 5.5 7.4 3.2 Q 7 12 7.6 20.6'],
  ['M 2.6 7.4 Q 3.6 3 7.4 3.3 Q 11.2 3.8 10.4 7.8 Q 9.2 12 2.8 20.4 Q 7 19.6 11.6 20.2'],
  [
    'M 2.8 5.4 Q 6 2.4 9.4 3.8 Q 11.6 5.6 9.2 9 Q 7.6 10.8 5.6 11 Q 11.4 11.4 11 15.8 Q 10.2 20.8 5.4 20.6 Q 3.2 20.4 2.2 18.8',
  ],
  ['M 8.4 3.2 Q 5 10 2.4 14.6 Q 7 14.2 12 14.2', 'M 9.4 8.6 Q 9 14.6 9.6 21'],
  [
    'M 10.8 3.4 Q 7 3.2 4.2 3.6 Q 3.8 7 3.4 10 Q 6 8.6 8.4 9.4 Q 11.6 10.8 11 15.2 Q 10.2 20.6 5.6 20.6 Q 3.4 20.4 2.2 18.8',
  ],
]

// Three wavy lines, the middle one shorter, standing in for writing.
const scribbles = [
  'M 1.2 5.5 Q 3 2 4.7 5.2 Q 6.4 7.9 8.1 5.6 Q 9.6 2.3 11.1 5.6 Q 12.6 8.6 14.2 5.3 Q 15.7 2.7 17.2 5.6 Q 19 9.1 20.7 5.5 Q 22.2 2.6 23.6 5.2 Q 25.2 7.8 26.7 5.4',
  'M 2.2 12 Q 3.6 9.5 5 12.1 Q 6.5 14.2 8.1 11.9 Q 9.7 9.8 11.2 11.7 Q 12.6 14.6 13.9 11.8 Q 15.6 9.4 17.3 11.8 Q 18.9 14.4 20.5 12.3 Q 22 9.2 23.5 12.3',
  'M 1.6 18.5 Q 3.2 15.8 4.8 18.8 Q 6.3 21.2 7.9 18.6 Q 9.4 16.2 11 18.6 Q 12.3 21.6 13.7 18.4 Q 15.4 16.3 17.1 18.6 Q 18.9 20.7 20.6 18.8 Q 22.2 15.6 23.8 18.3 Q 25.4 20.6 27 18.2',
]

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
