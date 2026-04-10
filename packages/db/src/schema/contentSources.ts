import { pgTable, real, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

export const contentSources = pgTable(
  'content_sources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull(),
    normalizedUrl: text('normalized_url').notNull(),
    sourceType: text('source_type').notNull(),
    sourceId: text('source_id'),
    originalUrl: text('original_url').notNull(),
    title: text('title').notNull(),
    artist: text('artist'),
    thumbnailUrl: text('thumbnail_url'),
    durationSeconds: real('duration_seconds'),
    r2KeyPrefix: text('r2_key_prefix').notNull(),
    status: text('status', {
      enum: ['processing', 'ready', 'error', 'expired'],
    })
      .notNull()
      .default('processing'),
    importedBy: uuid('imported_by').notNull(),
    lastAccessedAt: timestamp('last_accessed_at', { withTimezone: true }).defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [unique().on(table.workspaceId, table.normalizedUrl)],
);
