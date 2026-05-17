import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const players = sqliteTable('players', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  pinHash: text('pin_hash').notNull(),
  team: text('team', { enum: ['FIRST', 'SECOND'] }).notNull(),
  title: text('title'),
  mainUnit: text('main_unit'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  isAdmin: integer('is_admin', { mode: 'boolean' }).notNull().default(false),
  iconUrl: text('icon_url'),
})

export const events = sqliteTable('events', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  hasPromotionRelegation: integer('has_promotion_relegation', { mode: 'boolean' })
    .notNull()
    .default(false),
  venue: text('venue'),
  description: text('description'),
  heldAt: integer('held_at', { mode: 'timestamp' }).notNull(),
  phase: text('phase', { enum: ['COLLECTING', 'STAR_VOTING', 'REVEALING', 'DONE'] }).notNull(),
  revealPhase: integer('reveal_phase').notNull().default(0),
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
    submitted: integer('submitted', { mode: 'boolean' }).notNull().default(false),
    starVotingSubmitted: integer('star_voting_submitted', { mode: 'boolean' })
      .notNull()
      .default(false),
  },
  (table) => [uniqueIndex('scores_event_player_uniq').on(table.eventId, table.playerId)],
)

export const stars = sqliteTable(
  'stars',
  {
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
  },
  (table) => [
    uniqueIndex('stars_event_from_to_uniq').on(
      table.eventId,
      table.fromPlayerId,
      table.toPlayerId,
    ),
  ],
)

export type Player = typeof players.$inferSelect
export type Event = typeof events.$inferSelect
export type Score = typeof scores.$inferSelect
export type Star = typeof stars.$inferSelect
