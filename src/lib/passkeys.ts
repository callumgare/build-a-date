import 'server-only'
import { headers } from 'next/headers'
import { getAuth } from './auth'

export async function listPasskeys() {
  const passkeys = await getAuth().api.listPasskeys({
    headers: await headers(),
  })
  return passkeys.map(({ id, name, createdAt }) => ({
    id,
    name: name ?? null,
    createdAt,
  }))
}

export type PasskeySummary = Awaited<ReturnType<typeof listPasskeys>>[number]
