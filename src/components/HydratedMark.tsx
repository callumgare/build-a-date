'use client'

import { useEffect } from 'react'

// Marks the page once React has taken it over, so the end-to-end tests can
// wait for that before pressing anything: a click that lands before then
// does nothing (docs/testing.md § "Waiting for the page's script").
export default function HydratedMark() {
  useEffect(() => {
    document.documentElement.dataset.hydrated = ''
  }, [])
  return null
}
