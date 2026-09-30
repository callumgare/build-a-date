import type { DateCard } from '@/types'
import { PreviewCard } from './card'
import { deckGrid, FAN, fanTop, IMAGE, planFan } from './layout'

// The picture a messaging app shows for a shared link: the deck's name over
// the galaxy background, with its cards below, in a grid for a deck or
// fanned out like a hand for a plan (docs/share-previews.md). The browser
// draws it (src/lib/og/draw.tsx); this is just the tree Satori lays out.

export type PreviewInput = {
  title: string
  cards: Pick<DateCard, 'id' | 'title' | 'date'>[]
  layout: 'grid' | 'fan'
}

// --text-halo from src/styles.css, the halo headings on the site
// have. Satori can't read CSS variables, so it's copied here.
const BACKGROUND_TEXT_SHADOW = [
  '2px 2px 4px',
  '2px -2px 4px',
  '-2px -2px 4px',
  '-2px 2px 4px',
  '4px 4px 8px',
  '4px -4px 8px',
  '-4px -4px 8px',
  '-4px 4px 8px',
  '0 0 14px',
]
  .map((shadow) => `${shadow} rgb(17, 31, 82)`)
  .join(', ')

/** The cards that make it into the picture: the rest are off the edge. */
export function drawnCards({ cards, layout }: Pick<PreviewInput, 'cards' | 'layout'>) {
  return cards.slice(0, layout === 'grid' ? deckGrid(Number.MAX_SAFE_INTEGER).length : FAN.maxCards)
}

/**
 * `background` is the galaxy still's address. The browser leaves it out and
 * draws the still onto the canvas first, underneath (see draw.tsx).
 */
export function PreviewImage({ input, background }: { input: PreviewInput; background?: string }) {
  const cards = drawnCards(input)
  const places = input.layout === 'grid' ? deckGrid(cards.length) : planFan(cards.length)
  const long = input.title.length > 26
  // With no cards under it (the default picture, or a plan whose cards have
  // all gone), the name fills the picture instead.
  const alone = cards.length === 0
  const titleBox = alone
    ? { top: 0, height: IMAGE.height, fontSize: long ? 64 : 104 }
    : input.layout === 'fan'
      ? // Centred in the space above the fan.
        { top: 0, height: fanTop(places), fontSize: long ? 46 : 68 }
      : { top: long ? 28 : 44, height: long ? 124 : 96, fontSize: long ? 46 : 68 }

  return (
    <div style={{ display: 'flex', position: 'relative', width: '100%', height: '100%' }}>
      {background && (
        // biome-ignore lint/performance/noImgElement: Satori draws <img>, not next/image
        <img
          alt=""
          src={background}
          width={IMAGE.width}
          height={IMAGE.height}
          style={{ position: 'absolute', left: 0, top: 0 }}
        />
      )}
      <div
        style={{
          position: 'absolute',
          left: 60,
          right: 60,
          top: titleBox.top,
          height: titleBox.height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          // The site's heading gold (--accent).
          color: '#e5bc81',
          fontFamily: 'Tan Pearl',
          fontSize: titleBox.fontSize,
          lineHeight: 1.25,
          lineClamp: 2,
          textShadow: BACKGROUND_TEXT_SHADOW,
        }}
      >
        {input.title}
      </div>
      {places.map((at, index) => (
        <PreviewCard key={cards[index].id} card={cards[index]} at={at} />
      ))}
    </div>
  )
}
