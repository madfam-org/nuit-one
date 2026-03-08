import { describe, it, expect } from 'vitest';
import { healthRoutes } from './health.js';

describe('GET /health', () => {
  it('returns 200 status', async () => {
    const res = await healthRoutes.request('/');
    expect(res.status).toBe(200);
  });

  it('returns status ok and correct service name', async () => {
    const res = await healthRoutes.request('/');
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('nuit-one-api');
  });

  it('returns a valid ISO timestamp', async () => {
    const res = await healthRoutes.request('/');
    const body = await res.json();
    expect(body.timestamp).toBeDefined();
    const parsed = Date.parse(body.timestamp);
    expect(Number.isNaN(parsed)).toBe(false);
    // Verify it round-trips as a valid ISO string
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });
});
