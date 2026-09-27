import { Children, isValidElement, type ReactNode } from 'react'
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
      {/* biome-ignore lint/performance/noImgElement: Satori draws <img>, not next/image */}
      <img
        alt=""
        src={frameImage(frame, width - 2 * edge, height - 2 * edge)}
        width={width - 2 * edge}
        height={height - 2 * edge}
        style={{ position: 'absolute', left: edge, top: edge }}
      />
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
 * The frame as one SVG, sized to the card: the top piece, rails stretched
 * down to the bottom piece, and the bottom piece, as FrameArt lays them out
 * with CSS. Strokes are 1px wide, as `non-scaling-stroke` makes them on the
 * page.
 */
export function frameSvg(frame: Frame, width: number, height: number) {
  const unit = width / 200
  const tall = height / unit
  const railsFrom = frame.top.height
  const railsTo = round(tall - frame.bottom.height)
  const rails = frame.rails.map((x) => `M ${x} ${railsFrom} V ${railsTo}`).join(' ')
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 200 ${round(tall)}">`,
    `<style>svg * { fill: none; stroke: ${ART_COLOUR}; stroke-width: ${round(1 / unit)} } .fill, .fill * { fill: ${ART_COLOUR}; stroke: none } .faint { opacity: 0.55 }</style>`,
    toMarkup(frame.top.art),
    `<path d="${rails}"/>`,
    `<g transform="translate(0 ${railsTo})">${toMarkup(frame.bottom.art)}</g>`,
    '</svg>',
  ].join('')
}

function frameImage(frame: Frame, width: number, height: number) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(frameSvg(frame, width, height))}`
}

/**
 * Just enough of renderToStaticMarkup for the frames' art, which is plain SVG
 * elements: react-dom/server doesn't belong in a route.
 */
function toMarkup(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) => {
      if (!isValidElement<Record<string, unknown>>(child)) return typeof child === 'string' ? escapeXml(child) : ''
      const { children, ...props } = child.props
      if (typeof child.type !== 'string') return toMarkup(children as ReactNode)
      const attributes = Object.entries(props)
        .filter(([, value]) => value !== undefined && value !== null && value !== false)
        .map(([name, value]) => ` ${attributeName(name)}="${escapeXml(String(value))}"`)
        .join('')
      return `<${child.type}${attributes}>${toMarkup(children as ReactNode)}</${child.type}>`
    })
    .join('')
}

function attributeName(name: string) {
  if (name === 'className') return 'class'
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}

function escapeXml(text: string) {
  return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

function round(value: number) {
  return Math.round(value * 1000) / 1000
}
