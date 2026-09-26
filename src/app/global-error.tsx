'use client'

import ErrorPage from './error'
import '../styles.css'

// Replaces the root layout when the layout itself throws, so it has to bring
// its own <html> and <body>.
export default function GlobalError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body>
        <div className="app-root">
          <ErrorPage {...props} />
        </div>
      </body>
    </html>
  )
}
