import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { getUploadUrl } from '$lib/server/storage.js';
import { schema } from '@nuit-one/db';
import { eq } from 'drizzle-orm';
import { MAX_UPLOAD_SIZE_BYTES, SUPPORTED_MIME_TYPES } from '@nuit-one/shared';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
  const userId = locals.userId;
  if (!userId) throw error(401, 'Unauthorized');

  const body = await request.json();
  const { filename, contentType, size, projectId: requestedProjectId } = body as {
    filename: string;
    contentType: string;
    size: number;
    projectId?: string;
  };

  if (!filename || !contentType || !size) {
    throw error(400, 'Missing required fields: filename, contentType, size');
  }

  if (size > MAX_UPLOAD_SIZE_BYTES) {
    throw error(400, `File too large. Maximum size is ${MAX_UPLOAD_SIZE_BYTES / 1024 / 1024}MB`);
  }

  if (!SUPPORTED_MIME_TYPES.includes(contentType as typeof SUPPORTED_MIME_TYPES[number])) {
    throw error(400, `Unsupported audio format. Supported: ${SUPPORTED_MIME_TYPES.join(', ')}`);
  }

  const workspaceId = locals.workspaceId ?? '00000000-0000-0000-0000-000000000002';

  // Use requested project or find/create default
  let project = requestedProjectId
    ? await db.query.projects.findFirst({
        where: eq(schema.projects.id, requestedProjectId),
      })
    : await db.query.projects.findFirst({
        where: eq(schema.projects.workspaceId, workspaceId),
      });

  if (!project) {
    const [newProject] = await db
      .insert(schema.projects)
      .values({
        workspaceId,
        name: 'Bass Karaoke',
        createdBy: userId,
      })
      .returning();
    project = newProject!;
  }

  // Create track record
  const title = filename.replace(/\.[^.]+$/, '').replace(/[^\w\s\-().]/g, '').slice(0, 200) || 'Untitled';
  const [track] = await db
    .insert(schema.tracks)
    .values({
      projectId: project.id,
      userId,
      title,
      instrument: 'full_mix',
      status: 'pending_upload',
      originalFilename: filename,
      fileSizeBytes: size,
      contentType,
    })
    .returning();

  const r2Key = `tracks/${track!.id}/original/${filename}`;

  // Update track with R2 key
  await db
    .update(schema.tracks)
    .set({ r2Key })
    .where(eq(schema.tracks.id, track!.id));

  // Generate signed upload URL
  const uploadUrl = await getUploadUrl(r2Key, contentType);

  return json({ trackId: track!.id, uploadUrl });
};
