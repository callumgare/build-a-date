import { passkey } from '@better-auth/passkey'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { nextCookies } from 'better-auth/next-js'
import { magicLink } from 'better-auth/plugins/magic-link'
import * as authSchema from '../db/auth-schema'
import { sendEmail, signInEmail } from './email'

export type AuthEnv = {
  BETTER_AUTH_URL: string
  BETTER_AUTH_SECRET: string
  RESEND_API_KEY?: string
  EMAIL_FROM: string
  EMAIL_DELIVERY?: string
}

// Hosts on the local network that `next dev` can be reached at from another
// device, such as http://192.168.1.56:3000 from a phone.
const localNetworkHosts = ['192.168.*', '10.*', '172.*', '*.local']

// In production every link points at BETTER_AUTH_URL. Locally, links (like
// the one in the sign-in email) point back at whichever host the request
// came to, so signing in from a network address doesn't land on localhost.
export function baseURLConfig(url: string) {
  const { hostname, host, port } = new URL(url)
  if (hostname !== 'localhost') return url
  return {
    allowedHosts: [host, ...localNetworkHosts.map((pattern) => (port ? `${pattern}:${port}` : pattern))],
    fallback: url,
    // Trust the request's own scheme, as `next dev` can serve http or https.
    protocol: 'auto' as const,
  }
}

// Passkeys are the only way in. There are no passwords: a magic link signs a
// new user up, and signs in someone who has lost their passkey so they can
// register another.
export function createAuth(env: AuthEnv, db: Parameters<typeof drizzleAdapter>[0]) {
  const baseURL = env.BETTER_AUTH_URL
  const local = typeof baseURLConfig(baseURL) !== 'string'

  return betterAuth({
    baseURL: baseURLConfig(baseURL),
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, { provider: 'sqlite', schema: authSchema }),
    // Workers don't keep memory between requests, so limits live in D1.
    rateLimit: { storage: 'database' },
    // Cloudflare puts the visitor's address here; rate limits key on it.
    advanced: {
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
      // Better Auth skips checking origins under Vitest unless told not to,
      // which would hide a request from an untrusted host in the unit tests.
      disableOriginCheck: false,
      // Server actions hand Better Auth only the headers, with no URL to
      // read the scheme from, so locally it comes from the x-forwarded-proto
      // header `next dev` sets. Without it, links to a network address get
      // https even when the page is on http.
      trustedProxyHeaders: local,
    },
    plugins: [
      // Browsers only allow passkeys on a domain, so a network address like
      // 192.168.1.56 can sign in with a magic link but not a passkey.
      passkey({
        rpID: new URL(baseURL).hostname,
        rpName: 'Build-a-Date',
        origin: baseURL,
      }),
      magicLink({
        sendMagicLink: ({ email, url }) => sendEmail(env, signInEmail(email, url)),
      }),
      nextCookies(),
    ],
  })
}

export type Auth = ReturnType<typeof createAuth>
