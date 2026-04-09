import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import { describe, expect, it } from 'vitest';
import { createMockDbMiddleware } from '../test-utils/mock-db.js';
import { performanceRoutes } from './performances.js';

function createTestApp(userId = 'test-user-123', workspaceId = 'ws-456') {
  const app = new Hono();

  const fakeAuth = createMiddleware(async (c, next) => {
    c.set('auth', { userId, workspaceId });
    await next();
  });

  app.use('/*', fakeAuth);
  app.use('/*', createMockDbMiddleware());
  app.route('/', performanceRoutes);
  return app;
}

describe('POST /', () => {
  it('returns 400 when trackId is missing', async () => {
    const app = createTestApp();
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ totalScore: 100, accuracy: 50 }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Missing trackId');
  });

  it('returns 400 when totalScore is missing', async () => {
    const app = createTestApp();
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackId: '00000000-0000-0000-0000-000000000000', accuracy: 50 }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Missing totalScore');
  });

  it('returns 400 when accuracy is missing', async () => {
    const app = createTestApp();
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackId: '00000000-0000-0000-0000-000000000000', totalScore: 100 }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Missing accuracy');
  });

  it('returns 201 with id when all fields provided', async () => {
    const app = createTestApp();
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trackId: '00000000-0000-0000-0000-000000000000',
        totalScore: 100,
        accuracy: 50,
      }),
    });
    // Mock DB returns [{ id: 'mock-id' }] from insert().values().returning()
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe('mock-id');
  });
});

describe('GET /:trackId', () => {
  it('returns 200 with empty array when no performances exist', async () => {
    const app = createTestApp();
    const res = await app.request('/00000000-0000-0000-0000-000000000000');
    // Mock DB returns [] from select().from().where().orderBy()
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });
});
