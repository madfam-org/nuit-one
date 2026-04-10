import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const workspaceInvitations = pgTable('workspace_invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull(),
  email: text('email').notNull(),
  role: text('role', {
    enum: ['owner', 'admin', 'manager', 'member', 'viewer'],
  }).notNull().default('member'),
  invitedBy: uuid('invited_by').notNull(),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
