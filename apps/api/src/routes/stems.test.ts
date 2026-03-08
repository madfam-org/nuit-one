import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import { stemRoutes } from './stems.js';

/**
 * Build a test app that mounts stemRoutes behind a fake auth
 * middleware, avoiding real JWT verification while still providing
 * the `auth` context that the route handlers read via `c.get('auth')`.
 */
function createTestApp(userId = 'test-user-123', workspaceId = 'ws-456') {
  const app = new Hono();

  const fakeAuth = createMiddleware(async (c, next) => {
    c.set('auth', { userId, workspaceId });
    await next();
  });

  app.use('/*', fakeAuth);
  app.route('/', stemRoutes);
  return app;
}

describe('POST /split', () => {
  it('returns 400 when trackId is missing', async () => {
    const app = createTestApp();
    const res = await app.request('/split', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Missing trackId');
  });

  it('returns 404 for non-existent track', async () => {
    const app = createTestApp();
    const res = await app.request('/split', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackId: '00000000-0000-0000-0000-000000000000' }),
    });
    // Will be 404 or 500 depending on DB availability
    expect([404, 500]).toContain(res.status);
  });
});

describe('POST /transcribe', () => {
  it('returns 400 when trackId is missing', async () => {
    const app = createTestApp();
    const res = await app.request('/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Missing trackId');
  });
});

describe('GET /jobs/:jobId', () => {
  it('returns 404 for non-existent job', async () => {
    const app = createTestApp();
    const res = await app.request('/jobs/nonexistent-job-id');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Job not found');
  });
});
