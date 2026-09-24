// Only for `npm run auth:generate`, which reads the plugins' tables from this
// instance to write src/db/auth-schema.ts. The app uses getAuth().
import { drizzle } from 'drizzle-orm/d1'
import { createAuth } from './auth-config'

export const auth = createAuth(
  {
    BETTER_AUTH_URL: 'http://localhost:3000',
    BETTER_AUTH_SECRET: 'schema-generation-only',
    EMAIL_FROM: 'unused',
  },
  drizzle({} as D1Database),
)
