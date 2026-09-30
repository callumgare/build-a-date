'use client'

import { useRouter } from 'next/navigation'
import Button from '../ui/Button'
import { FormStack } from '../ui/Form'
import AddPasskeyButton from './AddPasskeyButton'

export default function WelcomePasskey({ next }: { next: string }) {
  const router = useRouter()

  return (
    <FormStack>
      <AddPasskeyButton onAdded={() => router.push(next)} />
      <Button variant="text" href={next}>
        Skip for now
      </Button>
    </FormStack>
  )
}
