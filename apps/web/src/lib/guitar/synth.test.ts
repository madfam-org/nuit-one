import { afterEach, describe, expect, it, vi } from 'vitest';
import { GuitarSynth, MAX_SPEED, MIN_SPEED, midiToHz, renderPluck } from './synth.js';

const SAMPLE_RATE = 44100;

/** Lag (in samples, with parabolic refinement) at which the signal best matches itself near `expected`. */
function measuredPeriod(samples: Float32Array, expected: number): number {
  const start = Math.floor(SAMPLE_RATE * 0.05);
  const span = Math.floor(SAMPLE_RATE * 0.25);
  const correlation = (lag: number): number => {
    let sum = 0;
    for (let i = start; i < start + span; i += 1) sum += (samples[i] ?? 0) * (samples[i + lag] ?? 0);
    return sum;
  };
  let bestLag = Math.floor(expected * 0.9);
  let best = Number.NEGATIVE_INFINITY;
  for (let lag = Math.floor(expected * 0.9); lag <= Math.ceil(expected * 1.1); lag += 1) {
    const value = correlation(lag);
    if (value > best) {
      best = value;
      bestLag = lag;
    }
  }
  const before = correlation(bestLag - 1);
  const after = correlation(bestLag + 1);
  const curvature = before - 2 * best + after;
  return bestLag + (curvature === 0 ? 0 : (0.5 * (before - after)) / curvature);
}

function rms(samples: Float32Array, fromSeconds: number, toSeconds: number): number {
  const from = Math.floor(fromSeconds * SAMPLE_RATE);
  const to = Math.floor(toSeconds * SAMPLE_RATE);
  let sum = 0;
  for (let i = from; i < to; i += 1) sum += (samples[i] ?? 0) ** 2;
  return Math.sqrt(sum / Math.max(1, to - from));
}

describe('midiToHz', () => {
  it('is equal temperament around A440', () => {
    expect(midiToHz(69)).toBe(440);
    expect(midiToHz(57)).toBeCloseTo(220, 9);
    expect(midiToHz(40)).toBeCloseTo(82.407, 3);
    expect(midiToHz(64)).toBeCloseTo(329.628, 3);
    expect(midiToHz(69, 442)).toBe(442);
  });
});

describe('renderPluck', () => {
  const base = { sampleRate: SAMPLE_RATE, holdSeconds: 2, velocity: 0.8 };

  for (const midi of [40, 55, 64, 76]) {
    it(`sounds at the right pitch (midi ${midi})`, () => {
      const frequency = midiToHz(midi);
      const samples = renderPluck({ ...base, frequency });
      const expected = SAMPLE_RATE / frequency;
      expect(Math.abs(measuredPeriod(samples, expected) - expected) / expected).toBeLessThan(0.003);
    });
  }

  it('stays finite and inside -1..1 even at full velocity', () => {
    const samples = renderPluck({ ...base, frequency: 196, velocity: 1 });
    let peak = 0;
    let nonFinite = 0;
    for (const x of samples) {
      if (!Number.isFinite(x)) nonFinite += 1;
      peak = Math.max(peak, Math.abs(x));
    }
    expect(nonFinite).toBe(0);
    expect(peak).toBeLessThanOrEqual(1);
    expect(peak).toBeGreaterThan(0.5);
  });

  it('decays like a plucked string', () => {
    const samples = renderPluck({ ...base, frequency: 196 });
    expect(rms(samples, 1, 1.1)).toBeLessThan(rms(samples, 0, 0.1) * 0.8);
    expect(rms(samples, 1, 1.1)).toBeGreaterThan(0);
  });

  it('is damped when the finger lifts, unless the string is let ring', () => {
    const damped = renderPluck({ ...base, frequency: 196, holdSeconds: 0.3, ring: false });
    const rung = renderPluck({ ...base, frequency: 196, holdSeconds: 0.3, ring: true });
    expect(damped.length / SAMPLE_RATE).toBeCloseTo(0.42, 1);
    expect(rung.length / SAMPLE_RATE).toBeGreaterThan(1.5);
    expect(rms(damped, 0.39, 0.41)).toBeLessThan(rms(damped, 0.25, 0.29) * 0.15);
  });

  it('is louder for harder plucks and brighter when asked', () => {
    const soft = renderPluck({ ...base, frequency: 196, velocity: 0.2 });
    const hard = renderPluck({ ...base, frequency: 196, velocity: 1 });
    expect(rms(hard, 0, 0.2)).toBeGreaterThan(rms(soft, 0, 0.2));

    const highEnd = (samples: Float32Array): number => {
      let diff = 0;
      let energy = 1e-12;
      for (let i = 1; i < SAMPLE_RATE * 0.2; i += 1) {
        const x = samples[i] ?? 0;
        diff += (x - (samples[i - 1] ?? 0)) ** 2;
        energy += x * x;
      }
      return diff / energy;
    };
    const dull = renderPluck({ ...base, frequency: 196, brightness: 0 });
    const bright = renderPluck({ ...base, frequency: 196, brightness: 1 });
    expect(highEnd(bright)).toBeGreaterThan(highEnd(dull));
  });

  it('is deterministic for a seed', () => {
    const a = renderPluck({ ...base, frequency: 330, seed: 5 });
    const b = renderPluck({ ...base, frequency: 330, seed: 5 });
    const c = renderPluck({ ...base, frequency: 330, seed: 6 });
    expect(Array.from(a.slice(0, 64))).toEqual(Array.from(b.slice(0, 64)));
    expect(Array.from(a.slice(0, 64))).not.toEqual(Array.from(c.slice(0, 64)));
  });

  it('returns silence for a pitch that cannot exist', () => {
    expect(Array.from(renderPluck({ ...base, frequency: 0 }))).toEqual([0]);
    expect(Array.from(renderPluck({ ...base, frequency: Number.NaN }))).toEqual([0]);
  });
});

// ---------------------------------------------------------------------------------------------
// GuitarSynth against a recording AudioContext
// ---------------------------------------------------------------------------------------------

interface MockSource {
  buffer: { length: number } | null;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  onended: (() => void) | null;
}

function createMockContext(initial: { currentTime?: number; state?: string } = {}) {
  const sources: MockSource[] = [];
  const bufferLengths: number[] = [];
  const makeGain = () => ({
    gain: {
      value: 1,
      cancelScheduledValues: vi.fn(),
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  });
  const ctx = {
    currentTime: initial.currentTime ?? 10,
    sampleRate: 8000,
    state: initial.state ?? 'running',
    destination: {},
    resume: vi.fn(async () => {}),
    createGain: vi.fn(makeGain),
    createDynamicsCompressor: vi.fn(() => ({
      threshold: { value: 0 },
      knee: { value: 0 },
      ratio: { value: 0 },
      attack: { value: 0 },
      release: { value: 0 },
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createBuffer: vi.fn((_channels: number, length: number, sampleRate: number) => {
      bufferLengths.push(length);
      const data = new Float32Array(length);
      return { length, sampleRate, numberOfChannels: 1, duration: length / sampleRate, getChannelData: () => data };
    }),
    createBufferSource: vi.fn(() => {
      const source: MockSource = {
        buffer: null,
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null,
      };
      sources.push(source);
      return source;
    }),
  };
  return { ctx, sources, bufferLengths, asContext: () => ctx as unknown as AudioContext };
}

const pluck = (onset: number, offset: number, midi = 57, extra: { fret?: number | null } = {}) => ({
  onset,
  offset,
  midi,
  velocity: 80,
  fret: extra.fret ?? 2,
});

describe('GuitarSynth', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('schedules the notes from the start point on the audio clock, at the chosen speed', () => {
    const { ctx, sources, asContext } = createMockContext({ currentTime: 10 });
    const synth = new GuitarSynth(asContext());
    synth.start([pluck(0.5, 0.9), pluck(1.0, 1.4), pluck(2.0, 2.5)], 0.9, 0.5);

    expect(sources).toHaveLength(2);
    expect(ctx.createBufferSource).toHaveBeenCalledTimes(2);
    const startAt = 10 + 0.06;
    expect(sources[0]?.start).toHaveBeenCalledTimes(1);
    expect(sources[0]?.start.mock.calls[0]?.[0]).toBeCloseTo(startAt + (1.0 - 0.9) / 0.5, 9);
    expect(sources[1]?.start.mock.calls[0]?.[0]).toBeCloseTo(startAt + (2.0 - 0.9) / 0.5, 9);
  });

  it('clamps speed to the supported range', () => {
    expect([MIN_SPEED, MAX_SPEED]).toEqual([0.5, 1]);
    const fast = createMockContext();
    new GuitarSynth(fast.asContext()).start([pluck(2, 2.5)], 1, 3);
    expect(fast.sources[0]?.start.mock.calls[0]?.[0]).toBeCloseTo(10.06 + 1, 9);
    const slow = createMockContext();
    new GuitarSynth(slow.asContext()).start([pluck(2, 2.5)], 1, 0.1);
    expect(slow.sources[0]?.start.mock.calls[0]?.[0]).toBeCloseTo(10.06 + 2, 9);
  });

  it('reports song time from the audio clock', () => {
    const { ctx, asContext } = createMockContext({ currentTime: 10 });
    const synth = new GuitarSynth(asContext());
    expect(synth.position()).toBeNull();
    synth.start([pluck(1, 1.5)], 0.9, 0.5);
    expect(synth.position()).toBeCloseTo(0.9, 9);
    ctx.currentTime = 10.06 + 0.5;
    expect(synth.position()).toBeCloseTo(0.9 + 0.5 * 0.5, 9);
  });

  it('stops every voice with a fade and forgets the session', () => {
    vi.useFakeTimers();
    const { sources, asContext } = createMockContext();
    const synth = new GuitarSynth(asContext());
    synth.start([pluck(0, 0.5), pluck(0.5, 1)], 0, 1);
    expect(synth.playing).toBe(true);
    synth.stop();
    expect(synth.playing).toBe(false);
    expect(synth.position()).toBeNull();
    for (const source of sources) {
      expect(source.stop).toHaveBeenCalledTimes(1);
      expect(source.onended).toBeNull();
    }
    vi.runAllTimers();
    for (const source of sources) expect(source.disconnect).toHaveBeenCalled();
  });

  it('replaces a running session when started again', () => {
    vi.useFakeTimers();
    const { sources, asContext } = createMockContext();
    const synth = new GuitarSynth(asContext());
    synth.start([pluck(0, 0.5)], 0, 1);
    synth.start([pluck(0, 0.5)], 0, 1);
    expect(sources).toHaveLength(2);
    expect(sources[0]?.stop).toHaveBeenCalledTimes(1);
    expect(sources[1]?.stop).not.toHaveBeenCalled();
  });

  it('renders an identical note once and reuses it', () => {
    const { ctx, asContext } = createMockContext();
    const synth = new GuitarSynth(asContext());
    synth.start([pluck(0, 0.4), pluck(1, 1.4), pluck(2, 2.4), pluck(3, 3.4, 60)], 0, 1);
    expect(ctx.createBuffer).toHaveBeenCalledTimes(2);
  });

  it('holds notes longer when the piece is slowed down, but keeps the pitch (same period)', () => {
    const normal = createMockContext();
    new GuitarSynth(normal.asContext()).start([pluck(0, 0.5)], 0, 1);
    const slow = createMockContext();
    new GuitarSynth(slow.asContext()).start([pluck(0, 0.5)], 0, 0.5);
    expect(slow.bufferLengths[0] ?? 0).toBeGreaterThan((normal.bufferLengths[0] ?? 0) * 1.5);
  });

  it('lets open strings ring', () => {
    const { bufferLengths, asContext } = createMockContext();
    new GuitarSynth(asContext()).start([pluck(0, 0.2, 45, { fret: 0 })], 0, 1);
    expect((bufferLengths[0] ?? 0) / 8000).toBeGreaterThan(1.5);
  });

  it('resumes a suspended context', () => {
    const { ctx, asContext } = createMockContext({ state: 'suspended' });
    new GuitarSynth(asContext()).start([pluck(0, 0.5)], 0, 1);
    expect(ctx.resume).toHaveBeenCalled();
  });

  it('ignores notes with unusable times', () => {
    const { sources, asContext } = createMockContext();
    new GuitarSynth(asContext()).start([pluck(Number.NaN, 1), pluck(1, Number.POSITIVE_INFINITY), pluck(1, 1.5)], 0, 1);
    expect(sources).toHaveLength(1);
  });
});
