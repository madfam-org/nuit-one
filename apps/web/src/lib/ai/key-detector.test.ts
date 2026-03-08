import { describe, it, expect } from 'vitest';
import { detectKey } from './key-detector.js';
import type { ChordEvent } from '@nuit-one/shared';

describe('key-detector', () => {
  it('returns a key result with confidence', () => {
    const chords: ChordEvent[] = [
      { time: 0, duration: 2, label: 'C' },
      { time: 2, duration: 2, label: 'F' },
      { time: 4, duration: 2, label: 'G' },
      { time: 6, duration: 2, label: 'C' },
    ];
    const result = detectKey(chords);
    expect(result).toHaveProperty('key');
    expect(result).toHaveProperty('confidence');
    expect(typeof result.key).toBe('string');
    expect(typeof result.confidence).toBe('number');
  });

  it('detects C major from typical C major chords', () => {
    const chords: ChordEvent[] = [
      { time: 0, duration: 4, label: 'C' },
      { time: 4, duration: 2, label: 'F' },
      { time: 6, duration: 2, label: 'G' },
      { time: 8, duration: 4, label: 'C' },
      { time: 12, duration: 2, label: 'Am' },
      { time: 14, duration: 2, label: 'G' },
    ];
    const result = detectKey(chords);
    expect(result.key).toBe('C major');
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('detects A as the root from A-centered chords', () => {
    const chords: ChordEvent[] = [
      { time: 0, duration: 4, label: 'Am' },
      { time: 4, duration: 2, label: 'Dm' },
      { time: 6, duration: 2, label: 'E' },
      { time: 8, duration: 4, label: 'Am' },
    ];
    const result = detectKey(chords);
    // The algorithm should detect A as the root note (major or minor)
    expect(result.key).toContain('A');
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('handles empty chord array', () => {
    const result = detectKey([]);
    expect(result).toHaveProperty('key');
    expect(result).toHaveProperty('confidence');
  });
});
