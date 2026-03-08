import { pgTable, uuid, text, integer, bigint, real, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { tracks } from './tracks.js';

export const stems = pgTable('stems', {
  id: uuid('id').primaryKey().defaultRandom(),
  trackId: uuid('track_id')
    .notNull()
    .references(() => tracks.id, { onDelete: 'cascade' }),
  stemType: text('stem_type', {
    enum: ['bass', 'no_bass', 'vocals', 'drums', 'other'],
  }),
  r2Key: text('r2_key').notNull(),
  fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }),
  durationSeconds: real('duration_seconds'),
  sampleRate: integer('sample_rate').default(44100),
  source: text('source', {
    enum: ['upload', 'recording', 'demucs', 'basic_pitch'],
  }),
  midiData: jsonb('midi_data'),
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
