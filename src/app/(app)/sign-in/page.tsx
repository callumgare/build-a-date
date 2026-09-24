import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import SignInForm from '@/components/auth/SignInForm'
import { getSession } from '@/lib/auth'

export const metadata: Metadata = { title: 'Sign in' }

export default async function SignIn({ searchParams }: PageProps<'/sign-in'>) {
  if (await getSession()) redirect('/decks')

  return (
    <section className="panel narrow">
      <h2>Sign in</h2>
      <SignInForm linkFailed={Boolean((await searchParams).error)} />
    </section>
  )
}
