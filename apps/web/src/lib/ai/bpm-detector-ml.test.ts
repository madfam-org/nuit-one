import { describe, expect, it } from 'vitest';
import { detectBpm } from './bpm-detector-ml.js';

describe('bpm-detector-ml', () => {
  it('returns a BPM result with confidence', () => {
    const sampleRate = 44100;
    const samples = new Float32Array(sampleRate * 4);
    // Generate clicks at 120 BPM (every 0.5 seconds)
    const interval = Math.floor(sampleRate * 0.5);
    for (let i = 0; i < samples.length; i += interval) {
      for (let j = 0; j < 200 && i + j < samples.length; j++) {
        samples[i + j] = (Math.random() - 0.5) * 2;
      }
    }

    const result = detectBpm(samples, sampleRate);
    expect(result).toHaveProperty('bpm');
    expect(result).toHaveProperty('confidence');
    expect(typeof result.bpm).toBe('number');
    expect(result.bpm).toBeGreaterThan(0);
  });

  it('returns reasonable BPM for short audio', () => {
    const sampleRate = 44100;
    const samples = new Float32Array(sampleRate); // 1 second
    const result = detectBpm(samples, sampleRate);
    // Multi-method voting may produce any value in range
    expect(result.bpm).toBeGreaterThanOrEqual(50);
    expect(result.bpm).toBeLessThanOrEqual(210);
  });

  it('returns a number for very short samples', () => {
    const sampleRate = 44100;
    const samples = new Float32Array(1000); // very short
    const result = detectBpm(samples, sampleRate);
    expect(typeof result.bpm).toBe('number');
    expect(result.bpm).toBeGreaterThan(0);
  });
});
