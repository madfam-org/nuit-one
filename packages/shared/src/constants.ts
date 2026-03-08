import type { HitResult } from './types/performance.js';

export const DEFAULT_TEMPO = 120;

export const DEFAULT_TIME_SIGNATURE = '4/4';

export const DEFAULT_SAMPLE_RATE = 44100;

export const DEFAULT_BUFFER_SIZE = 256;

export const MAX_TRACKS_PER_PROJECT = 10;

export const MAX_STEMS_PER_TRACK = 50;

export const MAX_UPLOAD_SIZE_MB = 50;

export const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024;

export const SUPPORTED_AUDIO_FORMATS = ['wav', 'flac', 'mp3', 'ogg'] as const;

export const SUPPORTED_MIME_TYPES = [
  'audio/wav', 'audio/x-wav', 'audio/wave',
  'audio/flac', 'audio/x-flac',
  'audio/mpeg', 'audio/mp3',
  'audio/ogg', 'audio/vorbis',
] as const;

export const TRACK_STATUSES = [
  'pending_upload', 'uploaded', 'processing', 'ready', 'error',
] as const;

export const STEM_TYPES = ['bass', 'no_bass', 'vocals', 'drums', 'other'] as const;

/** Hit timing windows in milliseconds */
export const HIT_WINDOWS: Readonly<Record<HitResult, number>> = {
  perfect: 25,
  great: 50,
  good: 100,
  miss: Infinity,
} as const;

/** Score points per hit judgment */
export const HIT_SCORES: Readonly<Record<HitResult, number>> = {
  perfect: 100,
  great: 75,
  good: 50,
  miss: 0,
} as const;
