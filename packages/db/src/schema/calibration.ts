import { pgTable, uuid, text, integer, real, boolean, timestamp } from 'drizzle-orm/pg-core';

export const calibrationProfiles = pgTable('calibration_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  deviceName: text('device_name').notNull(),
  inputLatencyMs: real('input_latency_ms').notNull(),
  outputLatencyMs: real('output_latency_ms').notNull(),
  displayLatencyMs: real('display_latency_ms').notNull(),
  bufferSize: integer('buffer_size').default(256),
  sampleRate: integer('sample_rate').default(44100),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
