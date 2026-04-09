import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull(),
  name: text('name').notNull(),
  tempoBpm: integer('tempo_bpm').default(120),
  timeSignature: text('time_signature').default('4/4'),
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
