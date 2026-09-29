import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import GalaxyBackground from '@/components/GalaxyBackground'
import HydratedMark from '@/components/HydratedMark'
import '../styles.css'

export const metadata: Metadata = {
  title: { default: 'Build-a-Date', template: '%s · Build-a-Date' },
  description: 'Make a deck of date ideas, share it, and let them build the date.',
  icons: {
    icon: [
      { url: '/favicon-96x96.png', type: 'image/png', sizes: '96x96' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/favicon.ico',
    apple: { url: '/apple-touch-icon.png', sizes: '180x180' },
  },
  appleWebApp: { title: 'Build-a-Date' },
  manifest: '/site.webmanifest',
}

export const viewport: Viewport = {
  themeColor: '#153b50',
}

// How much room the plan's scrollbar keeps on each side, measured before the
// page is first drawn, so a shrunk plan on a narrow screen is laid out with
// it from the start rather than sliding to its new size once the page's
// script runs (docs/card-layout.md § "Narrow screens" - the whole column
// shrinks). It's a <style> in the head rather than an attribute on a React
// element, which hydrating would then find changed. PlanBuilder measures it
// again the same way for its builder.
const measureScrollbarGutter = `(() => {
  const probe = document.createElement('div')
  probe.style.cssText = 'position:absolute;visibility:hidden;width:100px;height:10px;overflow-y:auto;scrollbar-gutter:stable both-edges;scrollbar-width:thin'
  document.body.appendChild(probe)
  const style = document.createElement('style')
  style.textContent = ':root{--scrollbar-gutter:' + (probe.offsetWidth - probe.clientWidth) / 2 + 'px}'
  document.head.appendChild(style)
  probe.remove()
})()`

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: a fixed script of our own, run before the page is drawn */}
        <script dangerouslySetInnerHTML={{ __html: measureScrollbarGutter }} />
        <GalaxyBackground />
        <div className="app-root">{children}</div>
        <HydratedMark />
      </body>
    </html>
  )
}
