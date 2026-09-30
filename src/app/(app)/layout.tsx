import type { ReactNode } from 'react'
import PageShell from '@/components/PageShell'
import SiteHeader from '@/components/SiteHeader'

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <PageShell>
      <SiteHeader />
      {children}
    </PageShell>
  )
}
