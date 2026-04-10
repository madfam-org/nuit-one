import { pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

export const workspaceMembers = pgTable(
  'workspace_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull(),
    userId: uuid('user_id').notNull(),
    role: text('role', {
      enum: ['owner', 'admin', 'manager', 'member', 'viewer'],
    }).notNull().default('member'),
    displayName: text('display_name').notNull(),
    avatarUrl: text('avatar_url'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [unique().on(table.workspaceId, table.userId)],
);
