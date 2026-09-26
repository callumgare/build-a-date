import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import GalaxyBackground from '@/components/GalaxyBackground'
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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <GalaxyBackground />
        <div className="app-root">{children}</div>
      </body>
    </html>
  )
}
