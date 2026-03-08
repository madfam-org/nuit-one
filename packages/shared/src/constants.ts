import type { HitResult } from './types/performance.js';

export const DEFAULT_TEMPO = 120;

export const DEFAULT_TIME_SIGNATURE = '4/4';

export const DEFAULT_SAMPLE_RATE = 44100;

export const DEFAULT_BUFFER_SIZE = 256;

export const MAX_TRACKS_PER_PROJECT = 10;

export const MAX_STEMS_PER_TRACK = 50;

export const SUPPORTED_AUDIO_FORMATS = ['wav', 'flac', 'mp3', 'ogg'] as const;

/** Hit timing windows in milliseconds */
export const HIT_WINDOWS: Readonly<Record<HitResult, number>> = {
  perfect: 25,
  great: 50,
  good: 100,
  miss: Infinity,
} as const;
