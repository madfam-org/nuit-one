import { describe, it, expect } from 'vitest';
import { isValidYouTubeUrl } from './youtube.js';

describe('isValidYouTubeUrl', () => {
  it('accepts standard youtube.com watch URL', () => {
    expect(isValidYouTubeUrl('https://www.youtube.com/watch?v=abc123')).toBe(true);
  });

  it('accepts youtube.com watch URL without www', () => {
    expect(isValidYouTubeUrl('https://youtube.com/watch?v=abc')).toBe(true);
  });

  it('accepts youtu.be short URL', () => {
    expect(isValidYouTubeUrl('https://youtu.be/abc123')).toBe(true);
  });

  it('accepts music.youtube.com watch URL', () => {
    expect(isValidYouTubeUrl('https://music.youtube.com/watch?v=abc')).toBe(true);
  });

  it('accepts http (non-https) URLs', () => {
    expect(isValidYouTubeUrl('http://www.youtube.com/watch?v=abc123')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(isValidYouTubeUrl('')).toBe(false);
  });

  it('rejects random URL', () => {
    expect(isValidYouTubeUrl('https://example.com/video')).toBe(false);
  });

  it('rejects ftp protocol', () => {
    expect(isValidYouTubeUrl('ftp://youtube.com/watch?v=abc')).toBe(false);
  });

  it('rejects look-alike domain', () => {
    expect(isValidYouTubeUrl('https://notyoutube.com/watch?v=abc')).toBe(false);
  });

  it('rejects javascript protocol', () => {
    expect(isValidYouTubeUrl('javascript:alert(1)')).toBe(false);
  });
});
