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

  // Fake auth middleware that injects a known auth context
  const fakeAuth = createMiddleware(async (c, next) => {
    c.set('auth', { userId, workspaceId });
    await next();
  });

  app.use('/*', fakeAuth);
  app.route('/', stemRoutes);
  return app;
}

describe('POST /split', () => {
  it('returns 501 not implemented', async () => {
    const app = createTestApp();
    const res = await app.request('/split', { method: 'POST' });
    expect(res.status).toBe(501);
  });

  it('returns a message and the authenticated userId', async () => {
    const app = createTestApp('user-abc');
    const res = await app.request('/split', { method: 'POST' });
    const body = await res.json();
    expect(body.message).toBe('Stem splitting not yet implemented');
    expect(body.userId).toBe('user-abc');
  });
});

describe('POST /transcribe', () => {
  it('returns 501 not implemented', async () => {
    const app = createTestApp();
    const res = await app.request('/transcribe', { method: 'POST' });
    expect(res.status).toBe(501);
  });

  it('returns a message and the authenticated userId', async () => {
    const app = createTestApp('user-xyz');
    const res = await app.request('/transcribe', { method: 'POST' });
    const body = await res.json();
    expect(body.message).toBe('Audio transcription not yet implemented');
    expect(body.userId).toBe('user-xyz');
  });
});
