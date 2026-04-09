import { jsonb, pgTable, real, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tracks } from './tracks.js';

export const trackAnalysis = pgTable('track_analysis', {
  id: uuid('id').primaryKey().defaultRandom(),
  trackId: uuid('track_id')
    .notNull()
    .references(() => tracks.id, { onDelete: 'cascade' }),
  key: text('key'),
  bpmDetected: real('bpm_detected'),
  chords: jsonb('chords').$type<Array<{ time: number; duration: number; label: string }>>(),
  difficultyTier: text('difficulty_tier', {
    enum: ['easy', 'medium', 'hard', 'expert'],
  }),
  analysisVersion: text('analysis_version'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
