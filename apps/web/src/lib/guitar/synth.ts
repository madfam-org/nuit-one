/**
 * A small plucked-string synthesiser for the demo piece: Karplus–Strong, no samples, no dependencies.
 *
 * Each note is rendered once into an AudioBuffer (a native WebAudio feedback delay cannot be shorter
 * than one render quantum, which would cap the pitch near 344 Hz) and the buffers are then scheduled
 * on the audio clock, so timing is sample-accurate whatever the main thread is doing. Slowing the
 * piece down stretches the notes' hold times, not their pitch.
 */

import type { GuitarNote } from '@nuit-one/shared';

export const MIN_SPEED = 0.5;
export const MAX_SPEED = 1;

/** Audio-clock lead between `start()` and the first sound, so scheduling never lands in the past. */
const START_LEAD_SECONDS = 0.06;
/** Damping time constant window after the finger lifts. */
const RELEASE_SECONDS = 0.12;
const MAX_NOTE_SECONDS = 4.2;
const STOP_FADE_SECONDS = 0.04;
/** Open strings and let-ring notes sound at least this long. */
const RING_SECONDS = 1.6;
/** Where along the string the pluck happens (fraction of its length): sets the tone colour. */
const PLUCK_POSITION = 0.17;

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export function midiToHz(midi: number, referenceHz = 440): number {
  return referenceHz * 2 ** ((midi - 69) / 12);
}

/** Small deterministic PRNG: a note always sounds the same, and tests are stable. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface PluckOptions {
  readonly frequency: number;
  readonly sampleRate: number;
  /** Seconds the finger keeps the string sounding before it is damped. */
  readonly holdSeconds: number;
  /** 0..1 */
  readonly velocity: number;
  /** 0..1: how much high end the pluck has. A natural harmonic is purer. */
  readonly brightness?: number;
  /** Let the string decay on its own instead of damping it at `holdSeconds` (open strings, let-ring). */
  readonly ring?: boolean;
  readonly seed?: number;
}

/**
 * One plucked-string note as mono samples in -1..1.
 *
 * The string is a delay line one period long, filled with a shaped noise burst. Each trip round the
 * loop it passes a two-point average (the high partials die first, as on a real string), a small loss
 * (the note decays; low strings ring longer) and a first-order all-pass that supplies the fraction of a
 * sample the integer delay line cannot, so the pitch is right to a few cents.
 */
export function renderPluck(options: PluckOptions): Float32Array {
  const { frequency, sampleRate } = options;
  if (!(frequency > 0) || !(sampleRate > 0)) return new Float32Array(1);

  const velocity = clamp(options.velocity, 0, 1);
  const brightness = clamp(options.brightness ?? 0.6, 0, 1);
  const hold = Math.max(0.05, options.holdSeconds);
  const sounding = options.ring ? Math.max(hold, RING_SECONDS) : hold;
  const length = Math.max(1, Math.ceil(Math.min(MAX_NOTE_SECONDS, sounding + RELEASE_SECONDS) * sampleRate));
  const out = new Float32Array(length);

  const period = sampleRate / frequency;
  const lineLength = Math.max(2, Math.floor(period - 1));
  // Loop delay = line + 0.5 (the average) + the all-pass's low-frequency delay: make it equal the period.
  const allpassDelay = clamp(period - 0.5 - lineLength, 0.1, 2);
  const allpassCoefficient = (1 - allpassDelay) / (1 + allpassDelay);

  // The pluck: low-passed noise (brighter for harder plucks), with a comb that notches the harmonics
  // that have a node where the string is plucked.
  const random = mulberry32(options.seed ?? 1);
  const smoothing = 0.25 + 0.7 * brightness;
  const noise = new Float32Array(lineLength);
  let smoothed = 0;
  for (let i = 0; i < lineLength; i += 1) {
    smoothed += smoothing * (random() * 2 - 1 - smoothed);
    noise[i] = smoothed;
  }
  const comb = Math.max(1, Math.round(lineLength * PLUCK_POSITION));
  const line = new Float32Array(lineLength);
  let mean = 0;
  for (let i = 0; i < lineLength; i += 1) {
    const value = (noise[i] ?? 0) - (noise[(i + comb) % lineLength] ?? 0);
    line[i] = value;
    mean += value;
  }
  mean /= lineLength;
  let peak = 1e-9;
  for (let i = 0; i < lineLength; i += 1) {
    const value = (line[i] ?? 0) - mean;
    line[i] = value;
    peak = Math.max(peak, Math.abs(value));
  }
  const amplitude = (0.25 + 0.75 * velocity) / peak;
  for (let i = 0; i < lineLength; i += 1) line[i] = (line[i] ?? 0) * amplitude;

  // Time to fall 60 dB: low strings sustain longer than high ones.
  const t60 = clamp(5 * (110 / frequency) ** 0.35, 0.9, 5.2);
  const loss = 10 ** (-3 / (t60 * frequency));

  const releaseStart = Math.floor(sounding * sampleRate);
  const releaseTau = (RELEASE_SECONDS * sampleRate) / 4;
  let position = 0;
  let previous = 0;
  let allpassIn = 0;
  let allpassOut = 0;
  for (let n = 0; n < length; n += 1) {
    const current = line[position] ?? 0;
    // Averaging with the previous output sample delays the loop by half a sample.
    const averaged = 0.5 * (current + previous);
    previous = current;
    const shifted = allpassCoefficient * (averaged - allpassOut) + allpassIn;
    allpassIn = averaged;
    allpassOut = shifted;
    line[position] = shifted * loss;
    position = (position + 1) % lineLength;
    out[n] = n >= releaseStart ? current * Math.exp(-(n - releaseStart) / releaseTau) : current;
  }

  // Close the buffer with a few milliseconds of fade so its end can never click.
  const fade = Math.min(length, Math.round(sampleRate * 0.004));
  for (let i = 0; i < fade; i += 1) {
    const index = length - 1 - i;
    out[index] = (out[index] ?? 0) * (i / fade);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------------------------

type SynthNote = Pick<GuitarNote, 'onset' | 'offset' | 'midi' | 'velocity' | 'fret' | 'techniques' | 'flags'>;

interface Session {
  readonly gain: GainNode;
  readonly sources: Set<AudioBufferSourceNode>;
  /** Audio-clock time at which song time `from` sounds. */
  readonly startAt: number;
  readonly from: number;
  readonly speed: number;
}

function isHarmonic(note: SynthNote): boolean {
  return (note.techniques ?? []).some((t) => t.kind === 'harmonic') || (note.flags ?? []).includes('harmonic-node');
}

function rings(note: SynthNote): boolean {
  return note.fret === 0 || (note.techniques ?? []).some((t) => t.kind === 'let-ring');
}

export class GuitarSynth {
  private readonly ctx: AudioContext;
  private readonly master: GainNode;
  private readonly compressor: DynamicsCompressorNode;
  private readonly cache = new Map<string, AudioBuffer>();
  private session: Session | null = null;

  constructor(ctx: AudioContext, options: { readonly volume?: number } = {}) {
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = options.volume ?? 0.55;
    // A strummed chord is six notes at once: keep the sum from clipping.
    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -16;
    this.compressor.knee.value = 14;
    this.compressor.ratio.value = 5;
    this.compressor.attack.value = 0.004;
    this.compressor.release.value = 0.2;
    this.master.connect(this.compressor);
    this.compressor.connect(ctx.destination);
  }

  get playing(): boolean {
    return this.session !== null;
  }

  /**
   * Schedule every note that starts at or after `fromSeconds` (song time) at `speed` times normal
   * tempo, replacing anything already playing. Speed is clamped to 0.5..1.
   */
  start(notes: readonly SynthNote[], fromSeconds: number, speed = 1): void {
    this.stop();
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => undefined);

    const rate = clamp(speed, MIN_SPEED, MAX_SPEED);
    const startAt = this.ctx.currentTime + START_LEAD_SECONDS;
    const session: Session = {
      gain: this.ctx.createGain(),
      sources: new Set(),
      startAt,
      from: fromSeconds,
      speed: rate,
    };
    session.gain.connect(this.master);

    for (const note of notes) {
      if (!Number.isFinite(note.onset) || !Number.isFinite(note.offset) || note.onset < fromSeconds - 1e-3) continue;
      const source = this.ctx.createBufferSource();
      source.buffer = this.bufferFor(note, Math.max(0.08, (note.offset - note.onset) / rate));
      source.connect(session.gain);
      source.onended = () => {
        session.sources.delete(source);
        source.disconnect();
      };
      source.start(startAt + Math.max(0, note.onset - fromSeconds) / rate);
      session.sources.add(source);
    }
    this.session = session;
  }

  /** Song time now, derived from the audio clock; null when nothing is playing. */
  position(): number | null {
    const { session } = this;
    if (!session) return null;
    return session.from + Math.max(0, this.ctx.currentTime - session.startAt) * session.speed;
  }

  /** Silence everything with a short fade so cutting a ringing string does not click. */
  stop(): void {
    const { session } = this;
    if (!session) return;
    this.session = null;
    const now = this.ctx.currentTime;
    const { gain } = session.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(0, now + STOP_FADE_SECONDS);
    for (const source of session.sources) {
      source.onended = null;
      try {
        source.stop(now + STOP_FADE_SECONDS + 0.01);
      } catch {
        /* already stopped */
      }
    }
    setTimeout(
      () => {
        for (const source of session.sources) source.disconnect();
        session.sources.clear();
        session.gain.disconnect();
      },
      (STOP_FADE_SECONDS + 0.1) * 1000,
    );
  }

  dispose(): void {
    this.stop();
    this.master.disconnect();
    this.compressor.disconnect();
    this.cache.clear();
  }

  private bufferFor(note: SynthNote, holdSeconds: number): AudioBuffer {
    const velocity = clamp(note.velocity / 127, 0, 1);
    const harmonic = isHarmonic(note);
    const ring = rings(note);
    const key = `${note.midi}|${Math.round(holdSeconds * 25)}|${Math.round(velocity * 12)}|${harmonic ? 'h' : 'n'}|${ring ? 'r' : 'd'}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const samples = renderPluck({
      frequency: midiToHz(note.midi),
      sampleRate: this.ctx.sampleRate,
      holdSeconds,
      velocity,
      brightness: harmonic ? 0.3 : 0.45 + 0.4 * velocity,
      ring,
      seed: note.midi * 31 + 7,
    });
    const buffer = this.ctx.createBuffer(1, samples.length, this.ctx.sampleRate);
    buffer.getChannelData(0).set(samples);
    this.cache.set(key, buffer);
    return buffer;
  }
}
