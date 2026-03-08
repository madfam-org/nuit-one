import { Hono } from 'hono';

export const stemRoutes = new Hono();

// POST /api/stems/split — Trigger Demucs stem splitting (Phase 4)
stemRoutes.post('/split', async (c) => {
  const auth = c.get('auth');
  // TODO Phase 4: Integrate Demucs stem splitting
  return c.json({
    message: 'Stem splitting not yet implemented',
    userId: auth.userId,
  }, 501);
});

// POST /api/stems/transcribe — Trigger Basic Pitch audio-to-MIDI (Phase 4)
stemRoutes.post('/transcribe', async (c) => {
  const auth = c.get('auth');
  // TODO Phase 4: Integrate Basic Pitch transcription
  return c.json({
    message: 'Audio transcription not yet implemented',
    userId: auth.userId,
  }, 501);
});
