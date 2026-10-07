import { describe, expect, it, vi } from 'vitest';
import demoJson from '../data/guitar-demo-performance.json';
import { fetchGuitarPerformance, fetchJobStatus, jobLabel, startGuitarIntake } from './api.js';

function respond(body: unknown, status = 200): typeof fetch {
  return vi.fn(
    async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
  );
}

describe('fetchGuitarPerformance', () => {
  it('returns the performance when the server has one', async () => {
    const fetchFn = respond({ performance: demoJson, available: true });
    const result = await fetchGuitarPerformance('track 1', fetchFn);
    expect(result.available).toBe(true);
    expect(result.performance?.notes).toHaveLength(43);
    expect(fetchFn).toHaveBeenCalledWith('/api/guitar/track%201', expect.anything());
  });

  it('says so when there is no transcription yet', async () => {
    expect(await fetchGuitarPerformance('t', respond({ performance: null, available: true }))).toEqual({
      available: true,
      performance: null,
    });
  });

  it('says so when guitar intake is not installed', async () => {
    expect(await fetchGuitarPerformance('t', respond({ performance: null, available: false }))).toEqual({
      available: false,
      performance: null,
    });
  });

  it('still shows a stored transcription when this server cannot run new intakes', async () => {
    const result = await fetchGuitarPerformance('t', respond({ performance: demoJson, available: false }));
    expect(result.available).toBe(false);
    expect(result.performance?.notes).toHaveLength(43);
  });

  it('throws a readable error when the server fails or sends rubbish', async () => {
    await expect(fetchGuitarPerformance('t', respond({ message: 'boom' }, 500))).rejects.toThrow('500');
    await expect(fetchGuitarPerformance('t', respond('nope'))).rejects.toThrow('unexpected');
    await expect(
      fetchGuitarPerformance('t', respond({ performance: { schema: 'x' }, available: true })),
    ).rejects.toThrow('format');
  });
});

describe('startGuitarIntake', () => {
  it('returns the job id and posts the track id as JSON', async () => {
    const fetchFn = respond({ jobId: 'job-9' });
    expect(await startGuitarIntake('abc', fetchFn)).toEqual({ ok: true, jobId: 'job-9' });
    const [url, init] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/guitar/intake');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ trackId: 'abc' });
  });

  it('treats a 503 as "not available here" and keeps the server message', async () => {
    expect(await startGuitarIntake('abc', respond({ message: 'Guitar intake is not installed.' }, 503))).toEqual({
      ok: false,
      unavailable: true,
      message: 'Guitar intake is not installed.',
    });
    expect(await startGuitarIntake('abc', respond({}, 503))).toMatchObject({ unavailable: true });
  });

  it('reports other failures without throwing', async () => {
    expect(await startGuitarIntake('abc', respond({ message: 'Track not found' }, 404))).toEqual({
      ok: false,
      unavailable: false,
      message: 'Track not found',
    });
    expect(await startGuitarIntake('abc', respond({}, 200))).toMatchObject({ ok: false });
    const offline = vi.fn(async () => {
      throw new TypeError('network down');
    });
    expect(await startGuitarIntake('abc', offline as unknown as typeof fetch)).toMatchObject({
      ok: false,
      unavailable: false,
    });
  });
});

describe('fetchJobStatus', () => {
  it('reads status and progress', async () => {
    expect(await fetchJobStatus('j', respond({ status: 'processing', progress: 42 }))).toEqual({
      status: 'processing',
      progress: 42,
      error: undefined,
    });
  });

  it('clamps progress and carries the error text', async () => {
    expect(await fetchJobStatus('j', respond({ status: 'error', progress: 180, error: 'no guitar found' }))).toEqual({
      status: 'error',
      progress: 100,
      error: 'no guitar found',
    });
    expect(await fetchJobStatus('j', respond({ status: 'queued' }))).toMatchObject({ progress: 0 });
  });

  it('returns null (try again) when the poll itself fails', async () => {
    expect(await fetchJobStatus('j', respond({}, 500))).toBeNull();
    expect(await fetchJobStatus('j', respond({ status: 'dancing', progress: 1 }))).toBeNull();
    const offline = vi.fn(async () => {
      throw new TypeError('network down');
    });
    expect(await fetchJobStatus('j', offline as unknown as typeof fetch)).toBeNull();
  });
});

describe('jobLabel', () => {
  it('speaks about the guitar, not about stems', () => {
    expect(jobLabel('processing')).toBe('Listening to the guitar');
    expect(jobLabel('complete')).toBe('Done');
  });
});
