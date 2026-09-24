import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '@/db/schema'

// A fresh in-memory SQLite database built from the same migrations wrangler
// applies to D1.
export function createTestDb() {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  const migrations = join(__dirname, '../../drizzle')
  for (const file of readdirSync(migrations)
    .filter((name) => name.endsWith('.sql'))
    .sort()) {
    for (const statement of readFileSync(join(migrations, file), 'utf8').split('--> statement-breakpoint')) {
      if (statement.trim()) sqlite.exec(statement)
    }
  }
  return drizzle(sqlite, { schema })
}

export async function createUser(db: ReturnType<typeof createTestDb>, id: string) {
  await db.insert(schema.user).values({ id, name: id, email: `${id}@example.com` })
  return id
}
