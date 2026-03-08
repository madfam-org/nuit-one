import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import { importRoutes } from './import.js';

/**
 * Build a test app that mounts importRoutes behind a fake auth
 * middleware, matching the pattern from stems.test.ts.
 */
function createTestApp(userId = 'test-user-123', workspaceId = 'ws-456') {
  const app = new Hono();

  const fakeAuth = createMiddleware(async (c, next) => {
    c.set('auth', { userId, workspaceId });
    await next();
  });

  app.use('/*', fakeAuth);
  app.route('/', importRoutes);
  return app;
}

describe('POST /youtube', () => {
  it('returns 400 when url is missing', async () => {
    const app = createTestApp();
    const res = await app.request('/youtube', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Missing url');
  });

  it('returns 400 for invalid YouTube URL', async () => {
    const app = createTestApp();
    const res = await app.request('/youtube', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com/not-youtube' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid YouTube URL');
  });

  it('returns a jobId for a valid YouTube URL', async () => {
    const app = createTestApp();
    const res = await app.request('/youtube', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }),
    });
    // The route creates a job and returns immediately with 200.
    // The background download will fail (no yt-dlp in test), but that
    // does not affect the synchronous response.
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.jobId).toBeDefined();
    expect(typeof body.jobId).toBe('string');
  });
});
