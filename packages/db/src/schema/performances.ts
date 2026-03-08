import { pgTable, uuid, real, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { tracks } from './tracks.js';
import { stems } from './stems.js';

export const performances = pgTable('performances', {
  id: uuid('id').primaryKey().defaultRandom(),
  trackId: uuid('track_id')
    .notNull()
    .references(() => tracks.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(),
  stemId: uuid('stem_id').references(() => stems.id),
  scoreTiming: real('score_timing'),
  scoreDynamics: real('score_dynamics'),
  scorePitch: real('score_pitch'),
  scoreOverall: real('score_overall'),
  midiData: jsonb('midi_data'),
  approved: boolean('approved').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
