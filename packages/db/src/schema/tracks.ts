import { bigint, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { projects } from './projects.js';

export const tracks = pgTable('tracks', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(),
  title: text('title').notNull(),
  instrument: text('instrument').notNull().default('full_mix'),
  status: text('status', {
    enum: [
      'pending_upload',
      'uploaded',
      'processing',
      'ready',
      'error',
      'needs_parts',
      'in_progress',
      'delivered',
      'approved',
    ],
  })
    .notNull()
    .default('pending_upload'),
  r2Key: text('r2_key'),
  originalFilename: text('original_filename'),
  fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }),
  contentType: text('content_type'),
  assignedTo: uuid('assigned_to'),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
