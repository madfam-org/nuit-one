import { describe, expect, it } from 'vitest';
import { normalizeUrl } from './url-normalizer.js';

describe('normalizeUrl', () => {
  describe('YouTube URLs', () => {
    it('normalizes standard youtube.com watch URL', () => {
      const result = normalizeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(result).toEqual({
        normalizedUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        sourceType: 'youtube',
        sourceId: 'dQw4w9WgXcQ',
      });
    });

    it('normalizes youtu.be short URL', () => {
      const result = normalizeUrl('https://youtu.be/dQw4w9WgXcQ');
      expect(result).toEqual({
        normalizedUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        sourceType: 'youtube',
        sourceId: 'dQw4w9WgXcQ',
      });
    });

    it('normalizes music.youtube.com URL', () => {
      const result = normalizeUrl('https://music.youtube.com/watch?v=abc123');
      expect(result).toEqual({
        normalizedUrl: 'https://www.youtube.com/watch?v=abc123',
        sourceType: 'youtube',
        sourceId: 'abc123',
      });
    });

    it('strips extra query params like t and list', () => {
      const result = normalizeUrl(
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10&list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf'
      );
      expect(result.normalizedUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(result.sourceId).toBe('dQw4w9WgXcQ');
    });

    it('strips UTM tracking params from YouTube URLs', () => {
      const result = normalizeUrl(
        'https://www.youtube.com/watch?v=abc&utm_source=twitter&utm_medium=social'
      );
      expect(result.normalizedUrl).toBe('https://www.youtube.com/watch?v=abc');
    });

    it('handles YouTube URL without v param', () => {
      const result = normalizeUrl('https://www.youtube.com/channel/UCtest');
      expect(result.sourceType).toBe('youtube');
      expect(result.sourceId).toBeNull();
    });
  });

  describe('SoundCloud URLs', () => {
    it('normalizes a standard SoundCloud track URL', () => {
      const result = normalizeUrl('https://soundcloud.com/artist-name/track-title');
      expect(result).toEqual({
        normalizedUrl: 'https://soundcloud.com/artist-name/track-title',
        sourceType: 'soundcloud',
        sourceId: 'artist-name/track-title',
      });
    });

    it('strips si tracking param', () => {
      const result = normalizeUrl('https://soundcloud.com/artist/track?si=abc123');
      expect(result.normalizedUrl).toBe('https://soundcloud.com/artist/track');
    });

    it('strips trailing slash', () => {
      const result = normalizeUrl('https://soundcloud.com/artist/track/');
      expect(result.normalizedUrl).toBe('https://soundcloud.com/artist/track');
    });

    it('handles artist-only URL (no sourceId)', () => {
      const result = normalizeUrl('https://soundcloud.com/artist-name');
      expect(result.sourceType).toBe('soundcloud');
      expect(result.sourceId).toBeNull();
    });
  });

  describe('Generic URLs', () => {
    it('strips UTM tracking params', () => {
      const result = normalizeUrl(
        'https://bandcamp.com/album/test?utm_source=twitter&utm_campaign=share'
      );
      expect(result.normalizedUrl).not.toContain('utm_source');
      expect(result.normalizedUrl).not.toContain('utm_campaign');
    });

    it('strips trailing slash', () => {
      const result = normalizeUrl('https://example.com/music/track/');
      expect(result.normalizedUrl).toBe('https://example.com/music/track');
    });

    it('returns hostname as sourceType for generic URLs', () => {
      const result = normalizeUrl('https://www.bandcamp.com/album');
      expect(result.sourceType).toBe('bandcamp.com');
      expect(result.sourceId).toBeNull();
    });

    it('sorts query params for consistent normalization', () => {
      const result = normalizeUrl('https://example.com/track?z=1&a=2');
      expect(result.normalizedUrl).toBe('https://example.com/track?a=2&z=1');
    });
  });

  describe('Invalid URLs', () => {
    it('throws for non-URL strings', () => {
      expect(() => normalizeUrl('not-a-url')).toThrow();
    });

    it('throws for empty string', () => {
      expect(() => normalizeUrl('')).toThrow();
    });
  });
});
