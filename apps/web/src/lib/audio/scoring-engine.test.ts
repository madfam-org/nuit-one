import { describe, it, expect } from 'vitest';
import { ScoringEngine } from './scoring-engine.js';
import type { NoteEvent } from '@nuit-one/shared';

function makeNotes(count: number, startOffset = 0): NoteEvent[] {
  return Array.from({ length: count }, (_, i) => ({
    startTime: startOffset + i * 1.0,
    duration: 0.5,
    pitch: 40 + i,
    velocity: 100,
  }));
}

describe('ScoringEngine', () => {
  describe('constructor', () => {
    it('creates engine with empty notes', () => {
      const engine = new ScoringEngine([]);
      expect(engine.totalNotes).toBe(0);
      expect(engine.totalScore).toBe(0);
      expect(engine.combo).toBe(0);
    });

    it('creates engine with notes', () => {
      const engine = new ScoringEngine(makeNotes(5));
      expect(engine.totalNotes).toBe(5);
    });

    it('sorts notes by startTime', () => {
      const unsorted: NoteEvent[] = [
        { startTime: 2.0, duration: 0.5, pitch: 42, velocity: 100 },
        { startTime: 0.5, duration: 0.5, pitch: 40, velocity: 100 },
        { startTime: 1.0, duration: 0.5, pitch: 41, velocity: 100 },
      ];
      const engine = new ScoringEngine(unsorted);
      expect(engine.totalNotes).toBe(3);
    });
  });

  describe('evaluate', () => {
    it('returns null for negative MIDI note', () => {
      const engine = new ScoringEngine(makeNotes(1));
      const result = engine.evaluate(0.25, -1);
      expect(result).toBeNull();
    });

    it('returns null when no notes match within timing window', () => {
      const engine = new ScoringEngine(makeNotes(1, 10));
      const result = engine.evaluate(0.0, 40);
      expect(result).toBeNull();
    });

    it('judges perfect hit (exact timing and pitch)', () => {
      const notes: NoteEvent[] = [
        { startTime: 1.0, duration: 0.5, pitch: 40, velocity: 100 },
      ];
      const engine = new ScoringEngine(notes);
      // Note center is at 1.25s, hit within 25ms
      const result = engine.evaluate(1.25, 40);
      expect(result).not.toBeNull();
      expect(result!.judgment).toBe('perfect');
    });

    it('judges great hit (timing within 50ms, pitch within 1 semitone)', () => {
      const notes: NoteEvent[] = [
        { startTime: 1.0, duration: 0.5, pitch: 40, velocity: 100 },
      ];
      const engine = new ScoringEngine(notes);
      // Hit 40ms off center with pitch 1 semitone away
      const result = engine.evaluate(1.25 + 0.04, 41);
      expect(result).not.toBeNull();
      expect(result!.judgment).toBe('great');
    });

    it('judges good hit (timing within 100ms)', () => {
      const notes: NoteEvent[] = [
        { startTime: 1.0, duration: 0.5, pitch: 40, velocity: 100 },
      ];
      const engine = new ScoringEngine(notes);
      // Hit 80ms off center
      const result = engine.evaluate(1.25 + 0.08, 42);
      expect(result).not.toBeNull();
      expect(result!.judgment).toBe('good');
    });

    it('does not re-hit already scored notes', () => {
      const notes: NoteEvent[] = [
        { startTime: 1.0, duration: 0.5, pitch: 40, velocity: 100 },
      ];
      const engine = new ScoringEngine(notes);
      const first = engine.evaluate(1.25, 40);
      expect(first).not.toBeNull();
      const second = engine.evaluate(1.25, 40);
      expect(second).toBeNull();
    });

    it('increments combo on successful hits', () => {
      const engine = new ScoringEngine(makeNotes(3));
      engine.evaluate(0.25, 40); // hit note 0
      expect(engine.combo).toBe(1);
      engine.evaluate(1.25, 41); // hit note 1
      expect(engine.combo).toBe(2);
      engine.evaluate(2.25, 42); // hit note 2
      expect(engine.combo).toBe(3);
    });

    it('adds score points on hit', () => {
      const engine = new ScoringEngine(makeNotes(1));
      engine.evaluate(0.25, 40);
      expect(engine.totalScore).toBeGreaterThan(0);
    });
  });

  describe('checkMisses', () => {
    it('returns empty array when no notes have been missed', () => {
      const engine = new ScoringEngine(makeNotes(1, 10));
      const misses = engine.checkMisses(0);
      expect(misses).toHaveLength(0);
    });

    it('marks notes as missed when past timing window', () => {
      const notes: NoteEvent[] = [
        { startTime: 0.0, duration: 0.5, pitch: 40, velocity: 100 },
      ];
      const engine = new ScoringEngine(notes);
      // Note ends at 0.5s, check at 0.7s (200ms past, beyond 100ms window)
      const misses = engine.checkMisses(0.7);
      expect(misses).toHaveLength(1);
      expect(misses[0]!.judgment).toBe('miss');
    });

    it('resets combo on miss', () => {
      const engine = new ScoringEngine(makeNotes(3));
      engine.evaluate(0.25, 40); // hit note 0
      engine.evaluate(1.25, 41); // hit note 1
      expect(engine.combo).toBe(2);
      // Skip note 2, check well past it
      engine.checkMisses(3.0);
      expect(engine.combo).toBe(0);
    });

    it('does not double-miss already scored notes', () => {
      const notes: NoteEvent[] = [
        { startTime: 0.0, duration: 0.5, pitch: 40, velocity: 100 },
      ];
      const engine = new ScoringEngine(notes);
      engine.evaluate(0.25, 40); // hit note
      const misses = engine.checkMisses(5.0);
      expect(misses).toHaveLength(0);
    });
  });

  describe('getResults', () => {
    it('returns a valid PerformanceResult', () => {
      const engine = new ScoringEngine(makeNotes(2));
      engine.evaluate(0.25, 40); // hit note 0
      engine.checkMisses(5.0); // miss note 1
      const results = engine.getResults();

      expect(results).toHaveProperty('totalScore');
      expect(results).toHaveProperty('maxCombo');
      expect(results).toHaveProperty('perfectCount');
      expect(results).toHaveProperty('greatCount');
      expect(results).toHaveProperty('goodCount');
      expect(results).toHaveProperty('missCount');
      expect(results).toHaveProperty('accuracy');
    });

    it('counts hits and misses correctly', () => {
      const engine = new ScoringEngine(makeNotes(3));
      engine.evaluate(0.25, 40); // hit note 0
      engine.evaluate(1.25, 41); // hit note 1
      engine.checkMisses(5.0); // miss note 2
      const results = engine.getResults();

      expect(results.missCount).toBeGreaterThanOrEqual(1);
      expect(results.perfectCount + results.greatCount + results.goodCount + results.missCount).toBe(3);
    });

    it('returns 0 accuracy for all misses', () => {
      const engine = new ScoringEngine(makeNotes(3));
      engine.checkMisses(10.0);
      const results = engine.getResults();
      expect(results.accuracy).toBe(0);
    });

    it('returns accuracy as percentage between 0 and 100', () => {
      const engine = new ScoringEngine(makeNotes(5));
      engine.evaluate(0.25, 40);
      engine.evaluate(1.25, 41);
      engine.checkMisses(10.0);
      const results = engine.getResults();
      expect(results.accuracy).toBeGreaterThanOrEqual(0);
      expect(results.accuracy).toBeLessThanOrEqual(100);
    });

    it('returns empty results for no notes', () => {
      const engine = new ScoringEngine([]);
      const results = engine.getResults();
      expect(results.totalScore).toBe(0);
      expect(results.maxCombo).toBe(0);
      expect(results.perfectCount).toBe(0);
      expect(results.missCount).toBe(0);
      expect(results.accuracy).toBe(0);
    });
  });

  describe('combo multiplier', () => {
    it('tracks max combo', () => {
      const engine = new ScoringEngine(makeNotes(5));
      engine.evaluate(0.25, 40);
      engine.evaluate(1.25, 41);
      engine.evaluate(2.25, 42);
      expect(engine.maxCombo).toBe(3);
      engine.checkMisses(5.0); // miss remaining
      expect(engine.maxCombo).toBe(3); // max should not decrease
    });

    it('hitCount tracks number of evaluated notes', () => {
      const engine = new ScoringEngine(makeNotes(5));
      expect(engine.hitCount).toBe(0);
      engine.evaluate(0.25, 40);
      expect(engine.hitCount).toBe(1);
      engine.evaluate(1.25, 41);
      expect(engine.hitCount).toBe(2);
    });
  });
});
