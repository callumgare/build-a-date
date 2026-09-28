import { Children, cloneElement, Fragment, isValidElement, type ReactNode } from 'react'
import { type Frame, frameFor } from '@/components/frames'
import type { DateCard } from '@/types'
import type { Placed } from './layout'

// A card as the preview image draws it: the deck page's card
// (src/components/Card.tsx) at a fixed size, with its frame and title but no
// description, which would be too small to read (docs/share-previews.md
// § "The cards"). Satori can't measure text as useFitText does, so titles step
// down by length instead.

const ART_COLOUR = '#a07c4c'

export function PreviewCard({ card, at }: { card: Pick<DateCard, 'id' | 'title' | 'date'>; at: Placed }) {
  const frame = frameFor(card.id)
  const { width, height } = at
  // As in Card.module.css: the art sits 4% in from the edge, and its
  // 200-unit canvas spans what's left.
  const edge = width * 0.04
  const unit = (width - 2 * edge) / 200
  const titleSize = width * titleScale(card.title)

  return (
    <div
      style={{
        position: 'absolute',
        left: at.x,
        top: at.y,
        width,
        height,
        display: 'flex',
        transform: `rotate(${at.rotate}deg)`,
        border: '1px solid rgba(111, 77, 43, 0.28)',
        borderRadius: 6,
        backgroundColor: '#f7f0e4',
        // As on the page, but fading to a clear white: Satori fades
        // `transparent` through black.
        backgroundImage:
          'radial-gradient(ellipse at 50% 30%, rgba(255, 255, 255, 0.35), rgba(255, 255, 255, 0) 70%), linear-gradient(rgba(255, 255, 255, 0.14), rgba(229, 214, 191, 0.12))',
        boxShadow: '0 12px 28px rgba(4, 23, 31, 0.35)',
      }}
    >
      <PreviewFrame frame={frame} width={width - 2 * edge} height={height - 2 * edge} left={edge} top={edge} />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          padding: `${edge + frame.inset.top * unit}px ${edge + frame.inset.side * unit}px ${edge + frame.inset.bottom * unit}px`,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            display: 'block',
            color: '#173d4c',
            fontFamily: 'Tan Pearl',
            fontSize: titleSize,
            lineHeight: 1.3,
            lineClamp: 4,
          }}
        >
          {card.title}
        </div>
        {card.date && (
          <div
            style={{
              marginTop: titleSize * 0.4,
              color: '#947347',
              fontFamily: 'Lora',
              fontSize: width * 0.052,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            {card.date}
          </div>
        )}
      </div>
    </div>
  )
}

/** The title's size, as a share of the card's width. */
export function titleScale(title: string) {
  if (title.length <= 14) return 0.12
  if (title.length <= 28) return 0.105
  if (title.length <= 48) return 0.09
  return 0.078
}

/**
 * The frame as one inline SVG, sized to the card: the top piece, rails
 * stretched down to the bottom piece, and the bottom piece, as FrameArt lays
 * them out with CSS. Strokes are 1px wide, as `non-scaling-stroke` makes them
 * on the page.
 *
 * It's drawn inline rather than as a picture inside the preview: Firefox
 * loads pictures inside an SVG in their own time, and the canvas the preview
 * is drawn onto doesn't wait for them (docs/share-previews.md § "Drawing in
 * the browser"). Satori copies inline SVG as it is, without stylesheets, so
 * the frames' classes become attributes.
 */
export function PreviewFrame({
  frame,
  width,
  height,
  left,
  top,
}: {
  frame: Frame
  width: number
  height: number
  left: number
  top: number
}) {
  const unit = width / 200
  const tall = round(height / unit)
  const railsTo = round(tall - frame.bottom.height)
  const rails = frame.rails.map((x) => `M ${x} ${frame.top.height} V ${railsTo}`).join(' ')
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox={`0 0 200 ${tall}`}
      fill="none"
      stroke={ART_COLOUR}
      strokeWidth={round(1 / unit)}
      style={{ position: 'absolute', left, top }}
    >
      {restyle(frame.top.art)}
      <path d={rails} />
      <g transform={`translate(0 ${railsTo})`}>{restyle(frame.bottom.art)}</g>
    </svg>
  )
}

// The classes Card.module.css gives the frames' art, as SVG attributes, which
// the pieces inside inherit.
const classAttributes: Record<string, Record<string, string | number>> = {
  fill: { fill: ART_COLOUR, stroke: 'none' },
  faint: { opacity: 0.55 },
}

function restyle(node: ReactNode): ReactNode {
  return Children.map(node, (child) => {
    if (!isValidElement<{ className?: string; children?: ReactNode }>(child)) return child
    const { className, children } = child.props
    // Satori's SVG writer only knows elements, so fragments are unwrapped.
    if (child.type === Fragment) return restyle(children)
    const attributes = Object.assign({}, ...(className ?? '').split(' ').map((name) => classAttributes[name] ?? {}))
    return cloneElement(child, className ? { ...attributes, className: undefined } : {}, restyle(children))
  })
}

function round(value: number) {
  return Math.round(value * 1000) / 1000
}
