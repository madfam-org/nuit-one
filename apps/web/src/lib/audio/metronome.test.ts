import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Metronome } from './metronome.js';

function createMockContext(): AudioContext {
  let _currentTime = 0;
  const mockOsc = {
    type: 'sine',
    frequency: { value: 440 },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
  const mockGain = {
    gain: { value: 0.5, exponentialRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
  };

  return {
    get currentTime() { return _currentTime; },
    set currentTime(v: number) { _currentTime = v; },
    destination: {} as AudioDestinationNode,
    createOscillator: vi.fn(() => mockOsc),
    createGain: vi.fn(() => mockGain),
  } as unknown as AudioContext;
}

describe('Metronome', () => {
  it('initializes with default tempo', () => {
    const ctx = createMockContext();
    const met = new Metronome(ctx);
    expect(met.tempo).toBe(120);
    expect(met.isRunning).toBe(false);
  });

  it('starts and stops', () => {
    const ctx = createMockContext();
    const met = new Metronome(ctx);
    met.start();
    expect(met.isRunning).toBe(true);
    met.stop();
    expect(met.isRunning).toBe(false);
  });

  it('clamps tempo within range', () => {
    const ctx = createMockContext();
    const met = new Metronome(ctx);
    met.tempo = 10;
    expect(met.tempo).toBe(20);
    met.tempo = 500;
    expect(met.tempo).toBe(300);
  });

  it('accepts custom tempo and beats per measure', () => {
    const ctx = createMockContext();
    const met = new Metronome(ctx, 140, 3);
    expect(met.tempo).toBe(140);
    met.beatsPerMeasure = 6;
    expect(met.currentBeat).toBe(0);
  });
});
