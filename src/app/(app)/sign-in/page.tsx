import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import SignInForm from '@/components/auth/SignInForm'
import Heading from '@/components/ui/Heading'
import Panel, { PanelFootnote } from '@/components/ui/Panel'
import { getSession } from '@/lib/auth'
import { safeNextPath } from '@/lib/validation'

export const metadata: Metadata = { title: 'Sign in' }

export default async function SignIn({ searchParams }: PageProps<'/sign-in'>) {
  const { error, next: nextParam } = await searchParams
  const next = safeNextPath(nextParam)
  if (await getSession()) redirect(next ?? '/decks')

  return (
    <Panel narrow>
      <Heading>Sign in</Heading>
      {next && <p>Sign in, or make an account, to carry on.</p>}
      <SignInForm linkFailed={Boolean(error)} next={next} />
      <PanelFootnote>
        New here? <Link href={next ? `/sign-up?next=${encodeURIComponent(next)}` : '/sign-up'}>Make an account</Link>
      </PanelFootnote>
    </Panel>
  )
}
