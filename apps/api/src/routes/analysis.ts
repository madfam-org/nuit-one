import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { schema } from '@nuit-one/db';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { ANALYSIS_VERSION, analyzeAudio, parseWav } from '../lib/analysis.js';
import { createJob, getJob, updateJob } from '../lib/job-manager.js';
import { downloadFile } from '../lib/storage.js';

export const analysisRoutes = new Hono();

// POST /api/analysis/:trackId — Trigger chord/key/BPM analysis
analysisRoutes.post('/:trackId', async (c) => {
  c.get('auth'); // verify authenticated
  const trackId = c.req.param('trackId');

  if (!trackId) return c.json({ error: 'Missing trackId' }, 400);

  const db = c.get('db');

  // Verify track exists and has an audio file
  const track = await db.query.tracks.findFirst({
    where: eq(schema.tracks.id, trackId),
  });

  if (!track) return c.json({ error: 'Track not found' }, 404);
  if (!track.r2Key) return c.json({ error: 'Track has no uploaded file' }, 400);

  // Check if analysis already exists for this version
  const existing = await db.query.trackAnalysis.findFirst({
    where: eq(schema.trackAnalysis.trackId, trackId),
  });

  if (existing && existing.analysisVersion === ANALYSIS_VERSION) {
    return c.json({ id: existing.id, status: 'already_complete' });
  }

  const job = createJob(trackId);
  const r2Key = track.r2Key;

  // Run analysis in background (don't await)
  void (async () => {
    const workDir = await mkdtemp(join(tmpdir(), 'nuit-analysis-'));
    const inputPath = join(workDir, 'input.wav');

    try {
      // Download audio file
      updateJob(job.id, { status: 'downloading', progress: 10 });
      await downloadFile(r2Key, inputPath);

      // Read and parse WAV
      updateJob(job.id, { status: 'processing', progress: 30 });
      const wavBuffer = await readFile(inputPath);
      const [samples, sampleRate] = parseWav(wavBuffer);

      // Run analysis
      updateJob(job.id, { status: 'processing', progress: 50 });
      const result = analyzeAudio(samples, sampleRate);

      // Estimate difficulty from chord complexity and tempo
      const uniqueChords = new Set(result.chords.map((ch) => ch.label)).size;
      const avgChordDuration =
        result.chords.length > 0 ? result.chords.reduce((s, ch) => s + ch.duration, 0) / result.chords.length : 4;
      let difficultyTier: 'easy' | 'medium' | 'hard' | 'expert';
      if (uniqueChords <= 3 && avgChordDuration > 2) {
        difficultyTier = 'easy';
      } else if (uniqueChords <= 6 && avgChordDuration > 1) {
        difficultyTier = 'medium';
      } else if (uniqueChords <= 10) {
        difficultyTier = 'hard';
      } else {
        difficultyTier = 'expert';
      }

      // Upsert analysis record
      updateJob(job.id, { status: 'uploading', progress: 90 });

      if (existing) {
        // Update existing record with new version
        await db
          .update(schema.trackAnalysis)
          .set({
            key: result.key,
            bpmDetected: result.bpm,
            chords: result.chords,
            difficultyTier,
            analysisVersion: ANALYSIS_VERSION,
          })
          .where(eq(schema.trackAnalysis.id, existing.id));
      } else {
        await db.insert(schema.trackAnalysis).values({
          trackId,
          key: result.key,
          bpmDetected: result.bpm,
          chords: result.chords,
          difficultyTier,
          analysisVersion: ANALYSIS_VERSION,
        });
      }

      updateJob(job.id, { status: 'complete', progress: 100 });
    } catch (err) {
      console.error(`Analysis job ${job.id} failed:`, err);
      const message = err instanceof Error ? err.message : 'Analysis failed';
      updateJob(job.id, { status: 'error', error: message });
    } finally {
      await rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  })();

  return c.json({ jobId: job.id, trackId });
});

// GET /api/analysis/jobs/:jobId — Poll analysis job status
analysisRoutes.get('/jobs/:jobId', (c) => {
  const jobId = c.req.param('jobId');
  const job = getJob(jobId);
  if (!job) return c.json({ error: 'Job not found' }, 404);
  return c.json(job);
});

// GET /api/analysis/:trackId — Retrieve analysis results
analysisRoutes.get('/:trackId', async (c) => {
  c.get('auth'); // verify authenticated
  const trackId = c.req.param('trackId');

  const db = c.get('db');
  const row = await db.query.trackAnalysis.findFirst({
    where: eq(schema.trackAnalysis.trackId, trackId),
  });

  if (!row) return c.json({ error: 'No analysis found for this track' }, 404);

  return c.json(row);
});
