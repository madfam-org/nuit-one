import type { MidiNote } from './midi.js';

export interface PerformanceScore {
  /** Timing accuracy (0-100) */
  readonly timing: number;
  /** Dynamics accuracy (0-100) */
  readonly dynamics: number;
  /** Pitch accuracy (0-100) */
  readonly pitch: number;
  /** Overall score (0-100) */
  readonly overall: number;
}

export type HitResult = 'perfect' | 'great' | 'good' | 'miss';

export interface NoteHit {
  readonly noteIndex: number;
  readonly result: HitResult;
  /** Timing offset from target in milliseconds */
  readonly timingOffsetMs: number;
  /** Pitch offset from target in cents */
  readonly pitchOffsetCents: number;
  /** Velocity difference from target */
  readonly velocityDelta: number;
}

export interface Performance {
  readonly id: string;
  readonly trackId: string;
  readonly userId: string;
  readonly stemId: string;
  readonly score: PerformanceScore;
  readonly midiData: readonly MidiNote[];
  readonly approved: boolean;
  readonly createdAt: string;
}
