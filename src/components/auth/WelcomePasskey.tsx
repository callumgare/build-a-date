'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AddPasskeyButton from './AddPasskeyButton'

export default function WelcomePasskey() {
  const router = useRouter()

  return (
    <div className="form">
      <AddPasskeyButton onAdded={() => router.push('/decks')} />
      <Link className="text-action" href="/decks">
        Skip for now
      </Link>
    </div>
  )
}
