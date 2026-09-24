import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import SignInForm from '@/components/auth/SignInForm'
import { getSession } from '@/lib/auth'
import { safeNextPath } from '@/lib/validation'

export const metadata: Metadata = { title: 'Sign in' }

export default async function SignIn({ searchParams }: PageProps<'/sign-in'>) {
  const { error, next: nextParam } = await searchParams
  const next = safeNextPath(nextParam)
  if (await getSession()) redirect(next ?? '/decks')

  return (
    <section className="panel narrow">
      <h2>Sign in</h2>
      {next && <p>Sign in, or make an account, to carry on.</p>}
      <SignInForm linkFailed={Boolean(error)} next={next} />
      <p className="panel-footnote">
        New here? <Link href={next ? `/sign-up?next=${encodeURIComponent(next)}` : '/sign-up'}>Make an account</Link>
      </p>
    </section>
  )
}
