import { relations, sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { user } from './auth-schema'

export * from './auth-schema'

const timestamps = {
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => new Date())
    .notNull(),
}

export const deck = sqliteTable(
  'deck',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    // The public id in share links (/d/…), kept apart from the id the owner's
    // pages use.
    shareId: text('share_id').notNull().unique(),
    ...timestamps,
  },
  (table) => [index('deck_owner_id_idx').on(table.ownerId)],
)

export const card = sqliteTable(
  'card',
  {
    id: text('id').primaryKey(),
    deckId: text('deck_id')
      .notNull()
      .references(() => deck.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    // Markdown.
    description: text('description').notNull().default(''),
    tags: text('tags', { mode: 'json' }).$type<string[]>().notNull().default(sql`'[]'`),
    date: text('date'),
    position: integer('position').notNull(),
    ...timestamps,
  },
  (table) => [index('card_deck_id_idx').on(table.deckId)],
)

// A plan someone built from a shared deck. It lists card ids rather than
// copies, so edits to a card show up in plans that include it, and deleted
// cards drop out.
export const plan = sqliteTable(
  'plan',
  {
    id: text('id').primaryKey(),
    deckId: text('deck_id')
      .notNull()
      .references(() => deck.id, { onDelete: 'cascade' }),
    cardIds: text('card_ids', { mode: 'json' }).$type<string[]>().notNull(),
    createdAt: timestamps.createdAt,
  },
  (table) => [index('plan_deck_id_idx').on(table.deckId)],
)

export const deckRelations = relations(deck, ({ one, many }) => ({
  owner: one(user, { fields: [deck.ownerId], references: [user.id] }),
  cards: many(card),
  plans: many(plan),
}))

export const cardRelations = relations(card, ({ one }) => ({
  deck: one(deck, { fields: [card.deckId], references: [deck.id] }),
}))

export const planRelations = relations(plan, ({ one }) => ({
  deck: one(deck, { fields: [plan.deckId], references: [deck.id] }),
}))

export type Deck = typeof deck.$inferSelect
export type CardRow = typeof card.$inferSelect
export type Plan = typeof plan.$inferSelect
