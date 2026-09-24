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

// Passkeys are the only way in. There are no passwords: a magic link signs a
// new user up, and signs in someone who has lost their passkey so they can
// register another.
export function createAuth(env: AuthEnv, db: Parameters<typeof drizzleAdapter>[0]) {
  const baseURL = env.BETTER_AUTH_URL

  return betterAuth({
    baseURL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, { provider: 'sqlite', schema: authSchema }),
    // Workers don't keep memory between requests, so limits live in D1.
    rateLimit: { storage: 'database' },
    // Cloudflare puts the visitor's address here; rate limits key on it.
    advanced: { ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] } },
    plugins: [
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
