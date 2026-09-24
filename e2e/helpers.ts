import { type APIRequestContext, expect, type Page } from '@playwright/test'

// Gives the page a platform authenticator that says yes to every passkey
// prompt, like a user touching their fingerprint reader. Passkeys it makes
// live as long as the page.
export async function addVirtualAuthenticator(page: Page) {
  const client = await page.context().newCDPSession(page)
  await client.send('WebAuthn.enable')
  const { authenticatorId } = await client.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  })
  return { client, authenticatorId }
}

// Reads the newest sign-in link sent to an address from the dev-only outbox
// (emails aren't really sent without a Resend key).
export async function latestSignInLink(request: APIRequestContext, email: string) {
  let link: string | undefined
  await expect(async () => {
    const response = await request.get(`/api/dev/outbox?to=${encodeURIComponent(email)}`)
    const emails: { text: string }[] = await response.json()
    link = emails.at(-1)?.text.match(/https?:\/\/\S+/)?.[0]
    expect(link).toBeTruthy()
  }).toPass({ timeout: 10_000 })
  return link as string
}

export function uniqueEmail(label: string) {
  return `${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`
}
