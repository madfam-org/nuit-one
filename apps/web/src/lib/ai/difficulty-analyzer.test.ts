import { describe, it, expect } from 'vitest';
import { analyzeDifficulty } from './difficulty-analyzer.js';
import type { NoteEvent } from '@nuit-one/shared';

describe('difficulty-analyzer', () => {
  it('returns easy for empty notes', () => {
    const result = analyzeDifficulty([], 60);
    expect(result.tier).toBe('easy');
    expect(result.score).toBe(0);
  });

  it('returns easy for sparse, simple notes', () => {
    const notes: NoteEvent[] = Array.from({ length: 10 }, (_, i) => ({
      startTime: i * 2,
      duration: 0.5,
      pitch: 40 + (i % 3), // small range
      velocity: 80,
    }));
    const result = analyzeDifficulty(notes, 20);
    expect(result.tier).toBe('easy');
    expect(result.score).toBeLessThan(20);
  });

  it('returns hard/expert for dense, wide-range notes', () => {
    const notes: NoteEvent[] = Array.from({ length: 200 }, (_, i) => ({
      startTime: i * 0.1,
      duration: 0.05 + Math.random() * 0.2,
      pitch: 30 + Math.floor(Math.random() * 48), // wide range
      velocity: 80,
    }));
    const result = analyzeDifficulty(notes, 20);
    expect(['hard', 'expert']).toContain(result.tier);
    expect(result.score).toBeGreaterThan(40);
  });

  it('has all factor fields', () => {
    const notes: NoteEvent[] = [
      { startTime: 0, duration: 0.5, pitch: 40, velocity: 80 },
      { startTime: 1, duration: 0.5, pitch: 45, velocity: 80 },
    ];
    const result = analyzeDifficulty(notes, 4);
    expect(result.factors).toHaveProperty('noteDensity');
    expect(result.factors).toHaveProperty('pitchRange');
    expect(result.factors).toHaveProperty('intervalComplexity');
    expect(result.factors).toHaveProperty('rhythmicComplexity');
  });
});
