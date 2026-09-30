import Link from 'next/link'
import { getSession } from '@/lib/auth'
import styles from './SiteHeader.module.css'
import Button from './ui/Button'

// The slim bar above the app's own pages. Marked data-site-header, which the
// stars look for (docs/ui-components.md § "Page frame").
export default async function SiteHeader() {
  const session = await getSession()

  return (
    <nav className={styles.header} aria-label="Main" data-site-header>
      <Link className={styles.brand} href={session ? '/decks' : '/'}>
        Build-a-Date
      </Link>
      <div className={styles.links}>
        {session ? (
          <>
            <Button variant="text" tone="subtle" href="/decks">
              Your decks
            </Button>
            <Button variant="text" tone="subtle" href="/settings">
              Settings
            </Button>
          </>
        ) : (
          <>
            <Button variant="text" tone="subtle" href="/sign-in">
              Sign in
            </Button>
            <Button variant="text" tone="subtle" href="/sign-up">
              Sign up
            </Button>
          </>
        )}
      </div>
    </nav>
  )
}
