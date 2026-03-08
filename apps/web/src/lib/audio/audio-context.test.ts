import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock AudioContext
class MockAudioContext {
  state = 'running';
  resume = vi.fn().mockResolvedValue(undefined);
  close = vi.fn().mockResolvedValue(undefined);
}

vi.stubGlobal('AudioContext', MockAudioContext);

// Must import after mock
const { getAudioContext, resumeContext, getContextState } = await import('./audio-context.js');

describe('audio-context singleton', () => {
  it('returns the same AudioContext on multiple calls', () => {
    const ctx1 = getAudioContext();
    const ctx2 = getAudioContext();
    expect(ctx1).toBe(ctx2);
  });

  it('reports context state', () => {
    getAudioContext(); // ensure created
    const state = getContextState();
    expect(state).toBe('running');
  });

  it('resumes a suspended context', async () => {
    const ctx = getAudioContext();
    (ctx as unknown as MockAudioContext).state = 'suspended';
    await resumeContext();
    expect((ctx as unknown as MockAudioContext).resume).toHaveBeenCalled();
  });
});
