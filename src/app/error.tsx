'use client'

import Link from 'next/link'
import Stars from '@/components/Stars'

// Shown in place of a page that threw while rendering, for example when the
// session can't be read, instead of leaving a blank screen. `retry` fetches
// the page from the server again, which `reset` alone wouldn't.
export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="page-shell">
      <Stars />
      <section className="panel narrow">
        <h2>Something went wrong</h2>
        <p>We couldn&apos;t load this page. It&apos;s probably not you, so try again in a moment.</p>
        <button className="done-button" type="button" onClick={retry}>
          Try again
        </button>
        <Link className="text-action" href="/">
          Go to Build-a-Date
        </Link>
      </section>
    </main>
  )
}
