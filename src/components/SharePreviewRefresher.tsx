'use client'

import { useEffect, useRef } from 'react'
import { saveDeckPreview } from '@/lib/actions/decks'
import { savePlanPreview } from '@/lib/actions/plans'
import { drawPreview } from '@/lib/og/client'
import type { PreviewInput } from '@/lib/og/preview'
import { previewKey } from '@/lib/og/preview-key'
import type { PreviewKind } from '@/lib/previews'

export type PreviewProps = {
  kind: PreviewKind
  /** The deck's id, or the plan's. */
  id: string
  /** What the picture should show now. */
  input: PreviewInput
  /** The key of the picture kept now, if there is one. */
  stored: string | null
}

/** How long to wait after the page settles, so a run of quick edits draws once. */
export const REFRESH_DELAY = 2000

/**
 * Draws a deck or plan's link preview again when the one kept is out of date,
 * or there isn't one yet, and sends it (docs/share-previews.md § "When it's
 * drawn"). Renders nothing. It's only on pages whose visitor may change the
 * picture, and a failure only means the old picture stays for now.
 */
export default function SharePreviewRefresher({ kind, id, input, stored }: PreviewProps) {
  const key = previewKey(input)
  // The key stands for the input, so a new input with the same key doesn't
  // start again.
  const latest = useRef(input)
  latest.current = input

  useEffect(() => {
    if (stored === key) return
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const preview = await drawPreview(latest.current, 15_000)
        if (cancelled) return
        const result = kind === 'deck' ? await saveDeckPreview(id, preview) : await savePlanPreview(id, preview)
        if (!result.ok) console.warn(`The link preview wasn't kept: ${result.error}`)
      } catch (error) {
        console.warn("Couldn't draw the link preview", error)
      }
    }, REFRESH_DELAY)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [kind, id, key, stored])

  return null
}
