import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import EmailLinkForm from '@/components/auth/EmailLinkForm'
import Heading from '@/components/ui/Heading'
import Panel, { PanelFootnote } from '@/components/ui/Panel'
import { getSession } from '@/lib/auth'
import { safeNextPath } from '@/lib/validation'

export const metadata: Metadata = { title: 'Sign up' }

export default async function SignUp({ searchParams }: PageProps<'/sign-up'>) {
  const next = safeNextPath((await searchParams).next)
  if (await getSession()) redirect(next ?? '/decks')

  return (
    <Panel narrow>
      <Heading>Make an account</Heading>
      <p>
        We&apos;ll email you a link to confirm it&apos;s you. Then you can set up a passkey, so there&apos;s no password
        to remember.
      </p>
      <EmailLinkForm askName submitLabel="Email me a link" next={next} />
      <PanelFootnote>
        Already have an account?{' '}
        <Link href={next ? `/sign-in?next=${encodeURIComponent(next)}` : '/sign-in'}>Sign in</Link>
      </PanelFootnote>
    </Panel>
  )
}
