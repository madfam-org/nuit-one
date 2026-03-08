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
  'needs_parts', 'in_progress', 'delivered', 'approved',
] as const;

export const STEM_TYPES = ['bass', 'no_bass', 'vocals', 'drums', 'other'] as const;

/** Playable instruments for karaoke mode */
export const PLAYABLE_INSTRUMENTS = ['bass', 'vocals', 'drums', 'other'] as const;
export type PlayableInstrument = (typeof PLAYABLE_INSTRUMENTS)[number];

/** Pitch detection frequency ranges per instrument (Hz) */
export const INSTRUMENT_FREQUENCY_RANGES: Record<PlayableInstrument, { min: number; max: number }> = {
  bass:   { min: 30,  max: 500  },
  vocals: { min: 80,  max: 1100 },
  drums:  { min: 60,  max: 500  },
  other:  { min: 27,  max: 4200 },
} as const;

/** NoteHighway MIDI pitch display ranges per instrument */
export const INSTRUMENT_MIDI_RANGES: Record<PlayableInstrument, { min: number; max: number }> = {
  bass:   { min: 28, max: 72  },
  vocals: { min: 36, max: 84  },
  drums:  { min: 35, max: 81  },
  other:  { min: 21, max: 108 },
} as const;

/** Display labels for instruments */
export const INSTRUMENT_LABELS: Record<PlayableInstrument, string> = {
  bass: 'Bass', vocals: 'Vocals', drums: 'Drums', other: 'Guitar / Keys',
} as const;

/** Neon colors for each instrument (Nuit Glass theme) */
export const INSTRUMENT_COLORS: Record<PlayableInstrument, string> = {
  bass: '#8b5cf6', vocals: '#00f5ff', drums: '#f59e0b', other: '#00ff88',
} as const;

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
