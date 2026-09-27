import { ImageResponse } from 'next/og'
import type { DateCard } from '@/types'
import { loadAsset } from './assets'
import { PreviewCard } from './card'
import { deckGrid, IMAGE, planFan } from './layout'

// The picture a messaging app shows for a shared link: the deck's name over
// the galaxy background, with its cards below, in a grid for a deck or
// fanned out like a hand for a plan (docs/share-previews.md).

export const previewSize = IMAGE
export const previewContentType = 'image/png'

// --background-text-shadow from src/styles.css, the halo headings on the site
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

type Preview = {
  title: string
  cards: Pick<DateCard, 'id' | 'title' | 'date'>[]
  layout: 'grid' | 'fan'
}

export async function renderShareImage({ title, cards, layout }: Preview) {
  const [background, tanPearl, lora] = await Promise.all([
    loadAsset('/og/background.jpg'),
    loadAsset('/tan-pearl.otf'),
    loadAsset('/og/lora-semibold.ttf'),
  ])
  const places = layout === 'grid' ? deckGrid(cards.length) : planFan(cards.length)
  const long = title.length > 26

  return new ImageResponse(
    <div style={{ display: 'flex', position: 'relative', width: '100%', height: '100%', backgroundColor: '#0e1a57' }}>
      {/* biome-ignore lint/performance/noImgElement: Satori draws <img>, not next/image */}
      <img
        alt=""
        src={`data:image/jpeg;base64,${toBase64(background)}`}
        width={IMAGE.width}
        height={IMAGE.height}
        style={{ position: 'absolute', left: 0, top: 0 }}
      />
      <div
        style={{
          position: 'absolute',
          left: 60,
          right: 60,
          top: long ? 28 : 44,
          height: long ? 124 : 96,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          // The site's heading gold (--accent).
          color: '#e5bc81',
          fontFamily: 'Tan Pearl',
          fontSize: long ? 46 : 68,
          lineHeight: 1.25,
          lineClamp: 2,
          textShadow: BACKGROUND_TEXT_SHADOW,
        }}
      >
        {title}
      </div>
      {places.map((at, index) => (
        <PreviewCard key={cards[index].id} card={cards[index]} at={at} />
      ))}
    </div>,
    {
      ...IMAGE,
      fonts: [
        { name: 'Tan Pearl', data: tanPearl, style: 'normal', weight: 400 },
        { name: 'Lora', data: lora, style: 'normal', weight: 600 },
      ],
      emoji: 'twemoji',
      headers: { 'Cache-Control': 'public, max-age=3600' },
    },
  )
}

function toBase64(data: ArrayBuffer) {
  return Buffer.from(data).toString('base64')
}
