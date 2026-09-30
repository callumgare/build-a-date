'use client'

import PageShell from '@/components/PageShell'
import Button from '@/components/ui/Button'
import Heading from '@/components/ui/Heading'
import Panel from '@/components/ui/Panel'

// Shown in place of a page that threw while rendering, for example when the
// session can't be read, instead of leaving a blank screen. `retry` fetches
// the page from the server again, which `reset` alone wouldn't.
export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <PageShell>
      <Panel narrow>
        <Heading>Something went wrong</Heading>
        <p>We couldn&apos;t load this page. It&apos;s probably not you, so try again in a moment.</p>
        <Button onClick={retry}>Try again</Button>
        <Button variant="text" href="/">
          Go to Build-a-Date
        </Button>
      </Panel>
    </PageShell>
  )
}
