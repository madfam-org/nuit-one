import type { HitResult } from './performance.js';

/** A single note event from audio-to-MIDI transcription */
export interface NoteEvent {
  /** Start time in seconds */
  readonly startTime: number;
  /** Duration in seconds */
  readonly duration: number;
  /** MIDI note number (e.g., 28-67 for bass guitar) */
  readonly pitch: number;
  /** Velocity 0-127 */
  readonly velocity: number;
}

/** Judgment for a single note hit during performance */
export type HitJudgment = HitResult;

/** Final results after completing a performance */
export interface PerformanceResult {
  readonly totalScore: number;
  readonly maxCombo: number;
  readonly perfectCount: number;
  readonly greatCount: number;
  readonly goodCount: number;
  readonly missCount: number;
  /** Accuracy as percentage 0-100 */
  readonly accuracy: number;
}

/** Request body for saving a performance */
export interface SavePerformanceRequest {
  readonly trackId: string;
  readonly stemId?: string | null;
  readonly totalScore: number;
  readonly maxCombo: number;
  readonly perfectCount: number;
  readonly greatCount: number;
  readonly goodCount: number;
  readonly missCount: number;
  readonly accuracy: number;
}
