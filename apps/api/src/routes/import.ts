import { rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { schema } from '@nuit-one/db';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { runDemucs } from '../lib/demucs.js';
import { createJob, updateJob } from '../lib/job-manager.js';
import { uploadFile } from '../lib/storage.js';
import { runTranscription } from '../lib/transcription.js';
import { extractMedia } from '../lib/media-extractor.js';
import { normalizeUrl } from '../lib/url-normalizer.js';

export const importRoutes = new Hono();

// POST /api/import/youtube — Import audio from any URL via yt-dlp
importRoutes.post('/youtube', async (c) => {
  const auth = c.get('auth');
  const { url } = await c.req.json<{ url: string }>();

  if (!url) return c.json({ error: 'Missing url' }, 400);
  try {
    new URL(url);
  } catch {
    return c.json({ error: 'Invalid URL' }, 400);
  }

  const db = c.get('db');
  const workspaceId = auth.workspaceId ?? '';

  // Normalize URL for dedup
  const { normalizedUrl, sourceType, sourceId } = normalizeUrl(url);

  // Check for existing content in this workspace
  const existing = await db.query.contentSources.findFirst({
    where: and(
      eq(schema.contentSources.workspaceId, workspaceId),
      eq(schema.contentSources.normalizedUrl, normalizedUrl),
    ),
  });

  if (existing) {
    if (existing.status === 'ready') {
      // Dedup hit — create a track reference pointing to existing content
      const project = await getOrCreateProject(db, workspaceId, auth.userId);

      const [track] = await db
        .insert(schema.tracks)
        .values({
          projectId: project.id,
          userId: auth.userId,
          title: existing.title,
          instrument: 'full_mix',
          status: 'ready',
          contentSourceId: existing.id,
        })
        .returning();

      // Update last accessed timestamp
      await db
        .update(schema.contentSources)
        .set({ lastAccessedAt: new Date() })
        .where(eq(schema.contentSources.id, existing.id));

      return c.json({ trackId: track!.id, cached: true });
    }

    if (existing.status === 'processing') {
      // Already being processed — create track reference, return pending
      const project = await getOrCreateProject(db, workspaceId, auth.userId);

      await db.insert(schema.tracks).values({
        projectId: project.id,
        userId: auth.userId,
        title: existing.title,
        instrument: 'full_mix',
        status: 'processing',
        contentSourceId: existing.id,
      });

      return c.json({ trackId: 'pending', processing: true, contentSourceId: existing.id });
    }

    // Status is 'error' or 'expired' — re-process below
    await db
      .update(schema.contentSources)
      .set({ status: 'processing' })
      .where(eq(schema.contentSources.id, existing.id));
  }

  // Determine contentSource ID — reuse existing or create new
  let csId: string;
  let r2Prefix: string;

  if (existing) {
    csId = existing.id;
    r2Prefix = existing.r2KeyPrefix;
  } else {
    const [contentSource] = await db
      .insert(schema.contentSources)
      .values({
        workspaceId,
        normalizedUrl,
        sourceType,
        sourceId: sourceId ?? '',
        originalUrl: url,
        title: 'Processing...',
        importedBy: auth.userId,
        r2KeyPrefix: '', // will be set after ID is generated
        status: 'processing',
      })
      .returning();

    csId = contentSource!.id;
    r2Prefix = `content/${csId}`;

    // Update r2KeyPrefix with the generated ID
    await db
      .update(schema.contentSources)
      .set({ r2KeyPrefix: r2Prefix })
      .where(eq(schema.contentSources.id, csId));
  }

  // Create job immediately so we can return jobId
  const job = createJob(csId);

  // Process in background
  void (async () => {
    let workDir: string | null = null;

    try {
      // Step 1: Download audio via yt-dlp
      updateJob(job.id, { status: 'downloading', progress: 5 });
      const ytResult = await extractMedia(url);
      workDir = dirname(ytResult.filePath);

      // Update contentSource with real metadata
      await db
        .update(schema.contentSources)
        .set({
          title: ytResult.title,
          artist: ytResult.artist,
          sourceType: ytResult.sourceType,
          sourceId: ytResult.sourceId,
          thumbnailUrl: ytResult.thumbnailUrl,
          durationSeconds: ytResult.durationSeconds,
        })
        .where(eq(schema.contentSources.id, csId));

      // Step 2: Create project + track in DB
      updateJob(job.id, { status: 'processing', progress: 15 });

      const project = await getOrCreateProject(db, workspaceId, auth.userId);

      const safeTitle = ytResult.title.replace(/[/\\:*?"<>|]/g, '_').slice(0, 200);

      const [track] = await db
        .insert(schema.tracks)
        .values({
          projectId: project.id,
          userId: auth.userId,
          title: ytResult.title,
          instrument: 'full_mix',
          status: 'uploaded',
          originalFilename: `${safeTitle}.wav`,
          fileSizeBytes: ytResult.fileSizeBytes,
          contentType: 'audio/wav',
          contentSourceId: csId,
        })
        .returning();

      // biome-ignore lint/style/noNonNullAssertion: insert().returning() always returns the row
      const trackId = track!.id;
      const r2Key = `${r2Prefix}/original/${safeTitle}.wav`;

      // Step 3: Upload WAV to storage
      updateJob(job.id, { status: 'uploading', progress: 20 });
      await uploadFile(r2Key, ytResult.filePath, 'audio/wav');

      // Update track with r2Key
      await db.update(schema.tracks).set({ r2Key }).where(eq(schema.tracks.id, trackId));

      // Step 4: Run Demucs stem separation (pass r2Prefix for content-based storage)
      await db.update(schema.tracks).set({ status: 'processing' }).where(eq(schema.tracks.id, trackId));
      const stems = await runDemucs(job.id, trackId, r2Key, r2Prefix);

      // Insert stem records with contentSourceId
      for (const stem of stems) {
        await db.insert(schema.stems).values({
          trackId,
          stemType: stem.stemType,
          r2Key: stem.r2Key,
          fileSizeBytes: stem.fileSizeBytes,
          source: 'demucs',
          createdBy: auth.userId,
          contentSourceId: csId,
        });
      }

      // Step 5: Run Basic Pitch transcription on all stems for this content source
      const allStems = await db.query.stems.findMany({
        where: eq(schema.stems.contentSourceId, csId),
      });

      for (const stem of allStems) {
        try {
          updateJob(job.id, {
            status: 'processing',
            progress: 85 + (allStems.indexOf(stem) / allStems.length) * 10,
          });
          const notes = await runTranscription(job.id, stem.r2Key);
          await db.update(schema.stems).set({ midiData: notes }).where(eq(schema.stems.id, stem.id));
        } catch (err) {
          console.warn(`Transcription failed for ${stem.stemType} stem (non-fatal):`, err);
        }
      }

      // Mark track ready
      await db.update(schema.tracks).set({ status: 'ready' }).where(eq(schema.tracks.id, trackId));

      // Mark content source ready
      await db
        .update(schema.contentSources)
        .set({ status: 'ready' })
        .where(eq(schema.contentSources.id, csId));

      // Also mark any other tracks referencing this content source as ready
      await db
        .update(schema.tracks)
        .set({ status: 'ready' })
        .where(and(eq(schema.tracks.contentSourceId, csId), eq(schema.tracks.status, 'processing')));

      updateJob(job.id, { status: 'complete', progress: 100 });
    } catch (err) {
      console.error(`Job ${job.id} failed:`, err);
      const message = err instanceof Error ? err.message : 'Import failed';
      updateJob(job.id, { status: 'error', error: message });
      await db
        .update(schema.contentSources)
        .set({ status: 'error' })
        .where(eq(schema.contentSources.id, csId));
    } finally {
      // Clean up temp directory
      if (workDir) {
        await rm(workDir, { recursive: true, force: true }).catch(() => {});
      }
    }
  })();

  return c.json({ jobId: job.id });
});

/** Find existing project for workspace or create "Imported Songs" default */
async function getOrCreateProject(
  db: ReturnType<typeof import('@nuit-one/db').createDb>,
  workspaceId: string,
  userId: string,
) {
  let project = await db.query.projects.findFirst({
    where: eq(schema.projects.workspaceId, workspaceId),
  });

  if (!project) {
    const [newProject] = await db
      .insert(schema.projects)
      .values({
        workspaceId,
        name: 'Imported Songs',
        createdBy: userId,
      })
      .returning();
    project = newProject!;
  }

  return project;
}
