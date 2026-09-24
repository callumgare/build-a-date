import { defineConfig } from 'drizzle-kit'

// Only generates SQL; wrangler applies it (`npm run db:migrate:local`).
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './drizzle',
})
