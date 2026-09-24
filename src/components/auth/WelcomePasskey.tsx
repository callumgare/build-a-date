'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AddPasskeyButton from './AddPasskeyButton'

export default function WelcomePasskey({ next }: { next: string }) {
  const router = useRouter()

  return (
    <div className="form">
      <AddPasskeyButton onAdded={() => router.push(next)} />
      <Link className="text-action" href={next}>
        Skip for now
      </Link>
    </div>
  )
}
