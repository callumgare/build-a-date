import type { ReactNode } from 'react'
import SiteHeader from '@/components/SiteHeader'
import Stars from '@/components/Stars'

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <main className="page-shell">
      <Stars />
      <SiteHeader />
      {children}
    </main>
  )
}
