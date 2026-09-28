'use client'

import { useEffect, useState } from 'react'
import { sampleDeck } from '@/data/sample-deck'
import { loadDraw } from '@/lib/og/client'
import type { PreviewInput } from '@/lib/og/preview'

// The pictures /dev/previews draws. `sample` and `default` are saved into
// public/og/; the fans are there to look at.
const pictures: Record<string, PreviewInput> = {
  sample: { title: sampleDeck.name, cards: sampleDeck.cards, layout: 'grid' },
  default: { title: 'Build-a-Date', cards: [], layout: 'grid' },
  'fan-1': { title: 'Weekend', cards: sampleDeck.cards.slice(0, 1), layout: 'fan' },
  'fan-3': { title: 'Weekend', cards: sampleDeck.cards.slice(0, 3), layout: 'fan' },
  'fan-12': {
    title: 'Our very long list of Melbourne date ideas 🌙',
    cards: sampleDeck.cards.slice(0, 12),
    layout: 'fan',
  },
}

export default function DevPreviews() {
  const [drawn, setDrawn] = useState<Record<string, string>>({})
  const [error, setError] = useState<string>()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { drawSharePreview } = await loadDraw()
      for (const [name, input] of Object.entries(pictures)) {
        const blob = await drawSharePreview(input)
        const url = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.readAsDataURL(blob)
        })
        if (!cancelled) setDrawn((previous) => ({ ...previous, [name]: url }))
      }
    })().catch((problem: unknown) => setError(String(problem)))
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main
      style={{ display: 'grid', gap: 24, padding: 24 }}
      data-done={Object.keys(drawn).length === Object.keys(pictures).length}
    >
      {error && (
        <p role="alert" data-preview-error>
          {error}
        </p>
      )}
      {Object.keys(pictures).map((name) => (
        <figure key={name} style={{ margin: 0 }}>
          <figcaption>{name}</figcaption>
          {/* biome-ignore lint/performance/noImgElement: a data URL to save, not a page image */}
          {drawn[name] && <img alt={name} data-preview={name} src={drawn[name]} width={600} height={315} />}
        </figure>
      ))}
    </main>
  )
}
