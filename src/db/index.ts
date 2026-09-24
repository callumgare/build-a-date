import { getCloudflareContext } from '@opennextjs/cloudflare'
import { type DrizzleD1Database, drizzle } from 'drizzle-orm/d1'
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core'
import { cache } from 'react'
import * as schema from './schema'

export { schema }

// D1 in production; tests swap in an in-memory SQLite database with the same
// schema, so code takes the common base type.
export type Database = BaseSQLiteDatabase<'async' | 'sync', unknown, typeof schema>

// The D1 binding belongs to the request, so the client is made per request.
export const getDb = cache((): DrizzleD1Database<typeof schema> => {
  return drizzle(getCloudflareContext().env.DB, { schema })
})
