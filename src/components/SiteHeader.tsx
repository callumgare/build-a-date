import Link from 'next/link'
import { getSession } from '@/lib/auth'

export default async function SiteHeader() {
  const session = await getSession()

  return (
    <nav className="site-header" aria-label="Main">
      <Link className="site-brand" href={session ? '/decks' : '/'}>
        Build-a-Date
      </Link>
      <div className="site-links">
        {session ? (
          <>
            <Link href="/decks">Your decks</Link>
            <Link href="/settings">Settings</Link>
          </>
        ) : (
          <>
            <Link href="/sign-in">Sign in</Link>
            <Link href="/sign-up">Sign up</Link>
          </>
        )}
      </div>
    </nav>
  )
}
