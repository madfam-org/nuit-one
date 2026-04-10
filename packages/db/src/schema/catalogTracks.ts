import { integer, pgTable, real, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const catalogTracks = pgTable('catalog_tracks', {
  id: uuid('id').primaryKey().defaultRandom(),
  sourceType: text('source_type').notNull(),
  sourceUrl: text('source_url').notNull(),
  sourceId: text('source_id'),
  title: text('title').notNull(),
  artist: text('artist'),
  album: text('album'),
  thumbnailUrl: text('thumbnail_url'),
  durationSeconds: real('duration_seconds'),
  genre: text('genre'),
  chartName: text('chart_name').notNull(),
  chartRank: integer('chart_rank'),
  chartDate: text('chart_date').notNull(),
  popularity: integer('popularity'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
