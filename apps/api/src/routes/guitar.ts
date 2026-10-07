import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { schema } from '@nuit-one/db';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { guitarPrefix, readPerformance, runGuitarIntake, transcriberAvailable } from '../lib/guitar-intake.js';
import { createJob, updateJob } from '../lib/job-manager.js';
import { downloadFile } from '../lib/storage.js';

export const guitarRoutes = new Hono();

type Db = ReturnType<typeof import('@nuit-one/db').createDb>;

/** The track, if it exists and belongs to the caller's workspace. */
async function findOwnTrack(db: Db, trackId: string, workspaceId: string | undefined) {
  const track = await db.query.tracks.findFirst({ where: eq(schema.tracks.id, trackId) });
  if (!track) return null;
  const project = await db.query.projects.findFirst({ where: eq(schema.projects.id, track.projectId) });
  if (!project || !workspaceId || project.workspaceId !== workspaceId) return null;
  return track;
}

// GET /api/guitar/:trackId: the track's guitar performance document, if transcribed
guitarRoutes.get('/:trackId', async (c) => {
  const auth = c.get('auth');
  const trackId = c.req.param('trackId');
  const db = c.get('db');
  const track = await findOwnTrack(db, trackId, auth.workspaceId);
  if (!track) return c.json({ error: 'Track not found' }, 404);
  const performance = await readPerformance(guitarPrefix(track.id, track.contentSourceId), downloadFile);
  return c.json({ performance, available: await transcriberAvailable() });
});

// POST /api/guitar/intake: transcribe a track's guitar part (string, fret, fingering, techniques)
guitarRoutes.post('/intake', async (c) => {
  const auth = c.get('auth');
  const { trackId } = await c.req.json<{ trackId?: string }>();
  if (!trackId) return c.json({ error: 'Missing trackId' }, 400);

  const db = c.get('db');
  const track = await findOwnTrack(db, trackId, auth.workspaceId);
  if (!track) return c.json({ error: 'Track not found' }, 404);

  if (!(await transcriberAvailable())) {
    return c.json({ error: 'Guitar intake is not available on this server' }, 503);
  }

  let sourceUrl: string | null = null;
  if (track.contentSourceId) {
    const source = await db.query.contentSources.findFirst({
      where: eq(schema.contentSources.id, track.contentSourceId),
    });
    sourceUrl = source?.originalUrl ?? null;
  }
  if (!sourceUrl && !track.r2Key) return c.json({ error: 'Track has no media to transcribe' }, 400);

  const job = createJob(track.id);
  const prefix = guitarPrefix(track.id, track.contentSourceId);
  const r2Key = track.r2Key;

  void (async () => {
    let workDir: string | null = null;
    try {
      let source = sourceUrl;
      if (!source && r2Key) {
        // an uploaded file: fetch it locally (audio only; fingering then relies on audio)
        updateJob(job.id, { status: 'downloading', progress: 2 });
        workDir = await mkdtemp(join(tmpdir(), 'nuit-guitar-src-'));
        source = join(workDir, `source${extname(r2Key) || '.wav'}`);
        await downloadFile(r2Key, source);
      }
      await runGuitarIntake(job.id, source as string, prefix);
      updateJob(job.id, { status: 'complete', progress: 100 });
    } catch (err) {
      console.error(`Guitar intake job ${job.id} failed:`, err);
      updateJob(job.id, { status: 'error', error: err instanceof Error ? err.message : 'Guitar intake failed' });
    } finally {
      if (workDir) await rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  })();

  return c.json({ jobId: job.id, trackId: track.id });
});
