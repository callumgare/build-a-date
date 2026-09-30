import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import WelcomePasskey from '@/components/auth/WelcomePasskey'
import Heading from '@/components/ui/Heading'
import Panel from '@/components/ui/Panel'
import { requireUser } from '@/lib/auth'
import { listPasskeys } from '@/lib/passkeys'
import { safeNextPath } from '@/lib/validation'

export const metadata: Metadata = { title: 'Welcome' }

export default async function Welcome({ searchParams }: PageProps<'/welcome'>) {
  const user = await requireUser()
  const next = safeNextPath((await searchParams).next) ?? '/decks'
  if ((await listPasskeys()).length > 0) redirect(next)

  return (
    <Panel narrow>
      <Heading>Welcome{user.name ? `, ${user.name}` : ''}</Heading>
      <p>
        Create a passkey to sign in with your fingerprint, face or device PIN, with no password. If you ever lose it, we
        can email you a link instead.
      </p>
      <WelcomePasskey next={next} />
    </Panel>
  )
}
