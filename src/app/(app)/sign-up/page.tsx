import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import EmailLinkForm from '@/components/auth/EmailLinkForm'
import { getSession } from '@/lib/auth'

export const metadata: Metadata = { title: 'Sign up' }

export default async function SignUp() {
  if (await getSession()) redirect('/decks')

  return (
    <section className="panel narrow">
      <h2>Make an account</h2>
      <p>
        We&apos;ll email you a link to confirm it&apos;s you. Then you can set up a passkey, so there&apos;s no password
        to remember.
      </p>
      <EmailLinkForm askName submitLabel="Email me a link" />
      <p className="panel-footnote">
        Already have an account? <Link href="/sign-in">Sign in</Link>
      </p>
    </section>
  )
}
