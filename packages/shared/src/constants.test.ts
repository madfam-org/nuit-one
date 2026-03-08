import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TEMPO,
  DEFAULT_TIME_SIGNATURE,
  DEFAULT_SAMPLE_RATE,
  DEFAULT_BUFFER_SIZE,
  MAX_TRACKS_PER_PROJECT,
  MAX_STEMS_PER_TRACK,
  MAX_UPLOAD_SIZE_MB,
  MAX_UPLOAD_SIZE_BYTES,
  SUPPORTED_AUDIO_FORMATS,
  SUPPORTED_MIME_TYPES,
  TRACK_STATUSES,
  STEM_TYPES,
  HIT_WINDOWS,
  HIT_SCORES,
} from './constants.js';

describe('constants', () => {
  describe('DEFAULT_TEMPO', () => {
    it('equals 120 BPM', () => {
      expect(DEFAULT_TEMPO).toBe(120);
    });

    it('is a positive number', () => {
      expect(DEFAULT_TEMPO).toBeGreaterThan(0);
    });
  });

  describe('DEFAULT_TIME_SIGNATURE', () => {
    it('equals 4/4', () => {
      expect(DEFAULT_TIME_SIGNATURE).toBe('4/4');
    });

    it('matches time signature format (numerator/denominator)', () => {
      expect(DEFAULT_TIME_SIGNATURE).toMatch(/^\d+\/\d+$/);
    });
  });

  describe('DEFAULT_SAMPLE_RATE', () => {
    it('equals 44100 Hz', () => {
      expect(DEFAULT_SAMPLE_RATE).toBe(44100);
    });

    it('is a standard audio sample rate', () => {
      const standardRates = [22050, 44100, 48000, 88200, 96000, 176400, 192000];
      expect(standardRates).toContain(DEFAULT_SAMPLE_RATE);
    });
  });

  describe('DEFAULT_BUFFER_SIZE', () => {
    it('equals 256 samples', () => {
      expect(DEFAULT_BUFFER_SIZE).toBe(256);
    });

    it('is a power of two', () => {
      expect(Math.log2(DEFAULT_BUFFER_SIZE) % 1).toBe(0);
    });
  });

  describe('MAX_TRACKS_PER_PROJECT', () => {
    it('equals 10', () => {
      expect(MAX_TRACKS_PER_PROJECT).toBe(10);
    });

    it('is a positive integer', () => {
      expect(MAX_TRACKS_PER_PROJECT).toBeGreaterThan(0);
      expect(Number.isInteger(MAX_TRACKS_PER_PROJECT)).toBe(true);
    });
  });

  describe('MAX_STEMS_PER_TRACK', () => {
    it('equals 50', () => {
      expect(MAX_STEMS_PER_TRACK).toBe(50);
    });

    it('is a positive integer', () => {
      expect(MAX_STEMS_PER_TRACK).toBeGreaterThan(0);
      expect(Number.isInteger(MAX_STEMS_PER_TRACK)).toBe(true);
    });
  });

  describe('SUPPORTED_AUDIO_FORMATS', () => {
    it('is a readonly array', () => {
      expect(Array.isArray(SUPPORTED_AUDIO_FORMATS)).toBe(true);
    });

    it('contains wav format', () => {
      expect(SUPPORTED_AUDIO_FORMATS).toContain('wav');
    });

    it('contains flac format', () => {
      expect(SUPPORTED_AUDIO_FORMATS).toContain('flac');
    });

    it('contains mp3 format', () => {
      expect(SUPPORTED_AUDIO_FORMATS).toContain('mp3');
    });

    it('contains ogg format', () => {
      expect(SUPPORTED_AUDIO_FORMATS).toContain('ogg');
    });

    it('contains exactly 4 formats', () => {
      expect(SUPPORTED_AUDIO_FORMATS).toHaveLength(4);
    });

    it('has no duplicate entries', () => {
      const unique = new Set(SUPPORTED_AUDIO_FORMATS);
      expect(unique.size).toBe(SUPPORTED_AUDIO_FORMATS.length);
    });

    it('contains only lowercase strings', () => {
      for (const format of SUPPORTED_AUDIO_FORMATS) {
        expect(format).toBe(format.toLowerCase());
      }
    });
  });

  describe('MAX_UPLOAD_SIZE_MB', () => {
    it('equals 50', () => {
      expect(MAX_UPLOAD_SIZE_MB).toBe(50);
    });

    it('is a positive number', () => {
      expect(MAX_UPLOAD_SIZE_MB).toBeGreaterThan(0);
    });
  });

  describe('MAX_UPLOAD_SIZE_BYTES', () => {
    it('equals MAX_UPLOAD_SIZE_MB * 1024 * 1024', () => {
      expect(MAX_UPLOAD_SIZE_BYTES).toBe(MAX_UPLOAD_SIZE_MB * 1024 * 1024);
    });

    it('equals 52428800 bytes (50 MB)', () => {
      expect(MAX_UPLOAD_SIZE_BYTES).toBe(52428800);
    });
  });

  describe('SUPPORTED_MIME_TYPES', () => {
    it('is a readonly array', () => {
      expect(Array.isArray(SUPPORTED_MIME_TYPES)).toBe(true);
    });

    it('contains wav MIME types', () => {
      expect(SUPPORTED_MIME_TYPES).toContain('audio/wav');
      expect(SUPPORTED_MIME_TYPES).toContain('audio/x-wav');
    });

    it('contains flac MIME types', () => {
      expect(SUPPORTED_MIME_TYPES).toContain('audio/flac');
    });

    it('contains mp3 MIME types', () => {
      expect(SUPPORTED_MIME_TYPES).toContain('audio/mpeg');
    });

    it('contains ogg MIME types', () => {
      expect(SUPPORTED_MIME_TYPES).toContain('audio/ogg');
    });

    it('has no duplicate entries', () => {
      const unique = new Set(SUPPORTED_MIME_TYPES);
      expect(unique.size).toBe(SUPPORTED_MIME_TYPES.length);
    });

    it('contains only strings starting with audio/', () => {
      for (const mime of SUPPORTED_MIME_TYPES) {
        expect(mime).toMatch(/^audio\//);
      }
    });
  });

  describe('TRACK_STATUSES', () => {
    it('is a readonly array', () => {
      expect(Array.isArray(TRACK_STATUSES)).toBe(true);
    });

    it('contains all upload lifecycle statuses', () => {
      expect(TRACK_STATUSES).toContain('pending_upload');
      expect(TRACK_STATUSES).toContain('uploaded');
      expect(TRACK_STATUSES).toContain('processing');
      expect(TRACK_STATUSES).toContain('ready');
      expect(TRACK_STATUSES).toContain('error');
    });

    it('has exactly 5 statuses', () => {
      expect(TRACK_STATUSES).toHaveLength(5);
    });

    it('has no duplicate entries', () => {
      const unique = new Set(TRACK_STATUSES);
      expect(unique.size).toBe(TRACK_STATUSES.length);
    });
  });

  describe('STEM_TYPES', () => {
    it('is a readonly array', () => {
      expect(Array.isArray(STEM_TYPES)).toBe(true);
    });

    it('contains bass and no_bass for karaoke mode', () => {
      expect(STEM_TYPES).toContain('bass');
      expect(STEM_TYPES).toContain('no_bass');
    });

    it('contains all stem types', () => {
      expect(STEM_TYPES).toContain('vocals');
      expect(STEM_TYPES).toContain('drums');
      expect(STEM_TYPES).toContain('other');
    });

    it('has exactly 5 types', () => {
      expect(STEM_TYPES).toHaveLength(5);
    });

    it('has no duplicate entries', () => {
      const unique = new Set(STEM_TYPES);
      expect(unique.size).toBe(STEM_TYPES.length);
    });
  });

  describe('HIT_WINDOWS', () => {
    it('has all expected keys', () => {
      expect(HIT_WINDOWS).toHaveProperty('perfect');
      expect(HIT_WINDOWS).toHaveProperty('great');
      expect(HIT_WINDOWS).toHaveProperty('good');
      expect(HIT_WINDOWS).toHaveProperty('miss');
    });

    it('has exactly 4 keys', () => {
      expect(Object.keys(HIT_WINDOWS)).toHaveLength(4);
    });

    it('has perfect window of 25ms', () => {
      expect(HIT_WINDOWS.perfect).toBe(25);
    });

    it('has great window of 50ms', () => {
      expect(HIT_WINDOWS.great).toBe(50);
    });

    it('has good window of 100ms', () => {
      expect(HIT_WINDOWS.good).toBe(100);
    });

    it('has miss window of Infinity', () => {
      expect(HIT_WINDOWS.miss).toBe(Infinity);
    });

    it('has windows in strictly ascending order (perfect < great < good < miss)', () => {
      expect(HIT_WINDOWS.perfect).toBeLessThan(HIT_WINDOWS.great);
      expect(HIT_WINDOWS.great).toBeLessThan(HIT_WINDOWS.good);
      expect(HIT_WINDOWS.good).toBeLessThan(HIT_WINDOWS.miss);
    });

    it('has all finite windows as positive numbers (except miss)', () => {
      expect(HIT_WINDOWS.perfect).toBeGreaterThan(0);
      expect(HIT_WINDOWS.great).toBeGreaterThan(0);
      expect(HIT_WINDOWS.good).toBeGreaterThan(0);
    });

    it('can classify any timing offset via ascending window thresholds', () => {
      // A timing offset of 10ms should fall within the perfect window
      expect(10).toBeLessThanOrEqual(HIT_WINDOWS.perfect);

      // A timing offset of 30ms exceeds perfect but falls within great
      expect(30).toBeGreaterThan(HIT_WINDOWS.perfect);
      expect(30).toBeLessThanOrEqual(HIT_WINDOWS.great);

      // A timing offset of 75ms exceeds great but falls within good
      expect(75).toBeGreaterThan(HIT_WINDOWS.great);
      expect(75).toBeLessThanOrEqual(HIT_WINDOWS.good);

      // A timing offset of 200ms exceeds good, so it is a miss
      expect(200).toBeGreaterThan(HIT_WINDOWS.good);
      expect(200).toBeLessThanOrEqual(HIT_WINDOWS.miss);
    });
  });

  describe('HIT_SCORES', () => {
    it('has all expected keys', () => {
      expect(HIT_SCORES).toHaveProperty('perfect');
      expect(HIT_SCORES).toHaveProperty('great');
      expect(HIT_SCORES).toHaveProperty('good');
      expect(HIT_SCORES).toHaveProperty('miss');
    });

    it('has exactly 4 keys', () => {
      expect(Object.keys(HIT_SCORES)).toHaveLength(4);
    });

    it('has perfect score of 100', () => {
      expect(HIT_SCORES.perfect).toBe(100);
    });

    it('has great score of 75', () => {
      expect(HIT_SCORES.great).toBe(75);
    });

    it('has good score of 50', () => {
      expect(HIT_SCORES.good).toBe(50);
    });

    it('has miss score of 0', () => {
      expect(HIT_SCORES.miss).toBe(0);
    });

    it('has scores in strictly descending order (perfect > great > good > miss)', () => {
      expect(HIT_SCORES.perfect).toBeGreaterThan(HIT_SCORES.great);
      expect(HIT_SCORES.great).toBeGreaterThan(HIT_SCORES.good);
      expect(HIT_SCORES.good).toBeGreaterThan(HIT_SCORES.miss);
    });

    it('has all scores as non-negative numbers', () => {
      for (const score of Object.values(HIT_SCORES)) {
        expect(score).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
