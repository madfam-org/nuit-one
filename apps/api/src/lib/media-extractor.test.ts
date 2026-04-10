import { describe, expect, it } from 'vitest';
import { parseYtDlpJson } from './media-extractor.js';

describe('parseYtDlpJson', () => {
  it('parses a complete YouTube JSON payload', () => {
    const result = parseYtDlpJson({
      title: 'Never Gonna Give You Up',
      uploader: 'Rick Astley',
      extractor_key: 'Youtube',
      id: 'dQw4w9WgXcQ',
      thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
      duration: 212,
    });

    expect(result).toEqual({
      title: 'Never Gonna Give You Up',
      artist: 'Rick Astley',
      sourceType: 'youtube',
      sourceId: 'dQw4w9WgXcQ',
      thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
      durationSeconds: 212,
    });
  });

  it('uses fulltitle as fallback for title', () => {
    const result = parseYtDlpJson({
      fulltitle: 'Full Title Fallback',
      extractor: 'soundcloud',
      id: 'sc-123',
    });

    expect(result.title).toBe('Full Title Fallback');
    expect(result.sourceType).toBe('soundcloud');
  });

  it('falls back to "Untitled" when no title fields exist', () => {
    const result = parseYtDlpJson({ id: 'abc' });
    expect(result.title).toBe('Untitled');
  });

  it('returns null for missing optional fields', () => {
    const result = parseYtDlpJson({
      title: 'Minimal Track',
      id: 'min-1',
      extractor_key: 'Generic',
    });

    expect(result.artist).toBeNull();
    expect(result.thumbnailUrl).toBeNull();
    expect(result.durationSeconds).toBeNull();
  });

  it('prefers uploader over artist over channel', () => {
    const withAll = parseYtDlpJson({
      title: 'T',
      uploader: 'Uploader',
      artist: 'Artist',
      channel: 'Channel',
      id: '1',
      extractor_key: 'X',
    });
    expect(withAll.artist).toBe('Uploader');

    const withArtistAndChannel = parseYtDlpJson({
      title: 'T',
      artist: 'Artist',
      channel: 'Channel',
      id: '2',
      extractor_key: 'X',
    });
    expect(withArtistAndChannel.artist).toBe('Artist');

    const withChannelOnly = parseYtDlpJson({
      title: 'T',
      channel: 'Channel',
      id: '3',
      extractor_key: 'X',
    });
    expect(withChannelOnly.artist).toBe('Channel');
  });

  it('lowercases the sourceType', () => {
    const result = parseYtDlpJson({
      title: 'T',
      extractor_key: 'BandCamp',
      id: 'bc-1',
    });
    expect(result.sourceType).toBe('bandcamp');
  });

  it('falls back to extractor when extractor_key is missing', () => {
    const result = parseYtDlpJson({
      title: 'T',
      extractor: 'vimeo',
      id: 'v-1',
    });
    expect(result.sourceType).toBe('vimeo');
  });

  it('uses "unknown" sourceType when no extractor fields exist', () => {
    const result = parseYtDlpJson({ title: 'T', id: '0' });
    expect(result.sourceType).toBe('unknown');
  });

  it('handles empty id gracefully', () => {
    const result = parseYtDlpJson({ title: 'T', extractor_key: 'X' });
    expect(result.sourceId).toBe('');
  });
});
