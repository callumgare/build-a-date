import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import WelcomePasskey from '@/components/auth/WelcomePasskey'
import { requireUser } from '@/lib/auth'
import { listPasskeys } from '@/lib/passkeys'

export const metadata: Metadata = { title: 'Welcome' }

export default async function Welcome() {
  const user = await requireUser()
  if ((await listPasskeys()).length > 0) redirect('/decks')

  return (
    <section className="panel narrow">
      <h2>Welcome{user.name ? `, ${user.name}` : ''}</h2>
      <p>
        Create a passkey to sign in with your fingerprint, face or device PIN, with no password. If you ever lose it, we
        can email you a link instead.
      </p>
      <WelcomePasskey />
    </section>
  )
}
