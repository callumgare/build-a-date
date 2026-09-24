import Link from 'next/link'
import Stars from '@/components/Stars'

export default function NotFound() {
  return (
    <main className="page-shell">
      <Stars />
      <section className="panel narrow">
        <h2>Nothing here</h2>
        <p>This link doesn&apos;t go anywhere. It may have been deleted, or mistyped.</p>
        <Link className="text-action" href="/">
          Go to Build-a-Date
        </Link>
      </section>
    </main>
  )
}
