import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import { describe, expect, it } from 'vitest';
import { createMockDbMiddleware } from '../test-utils/mock-db.js';
import { stemRoutes } from './stems.js';

/**
 * Build a test app that mounts stemRoutes behind a fake auth
 * middleware and a mock DB middleware, avoiding real JWT verification
 * and database connections while still providing the context variables
 * that the route handlers read via `c.get('auth')` and `c.get('db')`.
 */
function createTestApp(userId = 'test-user-123', workspaceId = 'ws-456') {
  const app = new Hono();

  const fakeAuth = createMiddleware(async (c, next) => {
    c.set('auth', { userId, workspaceId });
    await next();
  });

  app.use('/*', fakeAuth);
  app.use('/*', createMockDbMiddleware());
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
    // Mock DB returns null from findFirst, so handler returns 404
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Track not found');
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

  it('returns 404 when no bass stem exists', async () => {
    const app = createTestApp();
    const res = await app.request('/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackId: '00000000-0000-0000-0000-000000000000' }),
    });
    // Mock DB returns null from findFirst, so handler returns 404
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('No bass stem found');
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
