import { describe, expect, it } from 'vitest';
import { createJob, getJob, updateJob } from './job-manager.js';

describe('createJob', () => {
  it('creates a job with undefined trackId when no arg given', () => {
    const job = createJob();
    expect(job.id).toBeDefined();
    expect(job.trackId).toBeUndefined();
    expect(job.status).toBe('queued');
    expect(job.progress).toBe(0);
    expect(job.createdAt).toBeGreaterThan(0);
  });

  it('creates a job with trackId when provided', () => {
    const job = createJob('some-track');
    expect(job.trackId).toBe('some-track');
    expect(job.status).toBe('queued');
    expect(job.progress).toBe(0);
  });
});

describe('getJob', () => {
  it('returns undefined for non-existent job', () => {
    expect(getJob('does-not-exist')).toBeUndefined();
  });

  it('returns the created job', () => {
    const created = createJob('track-1');
    const retrieved = getJob(created.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(created.id);
    expect(retrieved?.trackId).toBe('track-1');
  });
});

describe('updateJob', () => {
  it('updates status and progress', () => {
    const job = createJob('track-2');
    updateJob(job.id, { status: 'processing', progress: 50 });

    const updated = getJob(job.id);
    expect(updated?.status).toBe('processing');
    expect(updated?.progress).toBe(50);
  });

  it('updates error field', () => {
    const job = createJob();
    updateJob(job.id, { status: 'error', error: 'something broke' });

    const updated = getJob(job.id);
    expect(updated?.status).toBe('error');
    expect(updated?.error).toBe('something broke');
  });

  it('does nothing for non-existent job', () => {
    // Should not throw
    updateJob('nonexistent', { status: 'complete', progress: 100 });
  });
});
