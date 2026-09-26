import type { Metadata } from 'next'
import AccountSettings from '@/components/auth/AccountSettings'
import NameForm from '@/components/auth/NameForm'
import { requireUser } from '@/lib/auth'
import { listPasskeys } from '@/lib/passkeys'

export const metadata: Metadata = { title: 'Settings' }

export default async function Settings() {
  const user = await requireUser()
  const passkeys = await listPasskeys()

  return (
    <section className="panel narrow">
      <h2>Settings</h2>
      <p>
        Signed in as <strong>{user.email}</strong>
      </p>
      <NameForm name={user.name} />
      <AccountSettings passkeys={passkeys} />
    </section>
  )
}
