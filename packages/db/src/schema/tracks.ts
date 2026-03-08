import { pgTable, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { projects } from './projects.js';

export const tracks = pgTable('tracks', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  instrument: text('instrument').notNull(),
  status: text('status', {
    enum: ['needs_parts', 'in_progress', 'delivered', 'approved'],
  })
    .notNull()
    .default('needs_parts'),
  assignedTo: uuid('assigned_to'),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
