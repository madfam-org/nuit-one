import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { guitarPrefix, jobProgress, parseProgressLine, resetTranscriberAvailability } from '../lib/guitar-intake.js';
import { createMockDbMiddleware } from '../test-utils/mock-db.js';
import { guitarRoutes } from './guitar.js';

vi.mock('../lib/storage.js', () => ({
  downloadFile: vi.fn().mockRejectedValue(new Error('not stored')),
  uploadFile: vi.fn().mockResolvedValue(undefined),
}));

function createTestApp(findFirst: unknown, workspaceId = 'ws-456') {
  const app = new Hono();
  app.use(
    '/*',
    createMiddleware(async (c, next) => {
      c.set('auth', { userId: 'user-1', workspaceId });
      await next();
    }),
  );
  app.use('/*', createMockDbMiddleware({ findFirst }));
  app.route('/', guitarRoutes);
  return app;
}

// The mock DB answers every findFirst with the same row, so one object stands for the track and
// its project.
const ownTrack = {
  id: 'track-1',
  projectId: 'project-1',
  workspaceId: 'ws-456',
  contentSourceId: null,
  r2Key: 'tracks/track-1/original.wav',
};

beforeEach(() => {
  process.env.NUIT_TRANSCRIBER_BIN = '/nonexistent/nuit-transcribe';
  resetTranscriberAvailability();
});

describe('GET /:trackId', () => {
  it('returns 404 for an unknown track', async () => {
    const res = await createTestApp(null).request('/track-1');
    expect(res.status).toBe(404);
  });

  it('returns 404 for a track in another workspace', async () => {
    const res = await createTestApp({ ...ownTrack, workspaceId: 'other-ws' }).request('/track-1');
    expect(res.status).toBe(404);
  });

  it('reports no performance yet and engine availability', async () => {
    const res = await createTestApp(ownTrack).request('/track-1');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ performance: null, available: false });
  });
});

describe('POST /intake', () => {
  const post = (app: Hono, body: unknown) =>
    app.request('/intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('requires a trackId', async () => {
    const res = await post(createTestApp(ownTrack), {});
    expect(res.status).toBe(400);
  });

  it('returns 404 for a track in another workspace', async () => {
    const res = await post(createTestApp({ ...ownTrack, workspaceId: 'other-ws' }), { trackId: 'track-1' });
    expect(res.status).toBe(404);
  });

  it('answers 503 when the engine is not installed on this server', async () => {
    const res = await post(createTestApp(ownTrack), { trackId: 'track-1' });
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/not available/);
  });
});

describe('guitar intake helpers', () => {
  it('parses engine progress lines and ignores noise', () => {
    expect(parseProgressLine('{"stage": "notes", "progress": 0.25}')).toEqual({
      stage: 'notes',
      progress: 0.25,
      error: undefined,
    });
    expect(parseProgressLine('[ 4.1s] notes 5%')).toBeNull();
    expect(parseProgressLine('{"stage": 3}')).toBeNull();
    expect(parseProgressLine('{broken')).toBeNull();
  });

  it('maps engine progress into the job band', () => {
    expect(jobProgress(0)).toBe(5);
    expect(jobProgress(1)).toBe(90);
    expect(jobProgress(2)).toBe(90);
  });

  it('stores outputs next to imported content, else under the track', () => {
    expect(guitarPrefix('t1', 'cs1')).toBe('content/cs1/guitar');
    expect(guitarPrefix('t1', null)).toBe('tracks/t1/guitar');
  });
});
