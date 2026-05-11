import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const players = sqliteTable('players', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  pinHash: text('pin_hash').notNull(),
  team: text('team', { enum: ['FIRST', 'SECOND'] }).notNull(),
  title: text('title'),
  mainUnit: text('main_unit'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

export const events = sqliteTable('events', {
  id: text('id').primaryKey(),
  heldAt: integer('held_at', { mode: 'timestamp' }).notNull(),
  phase: text('phase', { enum: ['COLLECTING', 'REVEALING', 'DONE'] }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

export const scores = sqliteTable(
  'scores',
  {
    id: text('id').primaryKey(),
    eventId: text('event_id')
      .notNull()
      .references(() => events.id),
    playerId: text('player_id')
      .notNull()
      .references(() => players.id),
    wins: integer('wins').notNull().default(0),
    losses: integer('losses').notNull().default(0),
    absent: integer('absent', { mode: 'boolean' }).notNull().default(false),
  },
  (table) => [uniqueIndex('scores_event_player_uniq').on(table.eventId, table.playerId)],
)

export const stars = sqliteTable('stars', {
  id: text('id').primaryKey(),
  eventId: text('event_id')
    .notNull()
    .references(() => events.id),
  fromPlayerId: text('from_player_id')
    .notNull()
    .references(() => players.id),
  toPlayerId: text('to_player_id')
    .notNull()
    .references(() => players.id),
  count: integer('count').notNull(),
})

export type Player = typeof players.$inferSelect
export type Event = typeof events.$inferSelect
export type Score = typeof scores.$inferSelect
export type Star = typeof stars.$inferSelect
