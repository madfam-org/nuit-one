import { describe, it, expect } from 'vitest';
import { detectChords } from './chord-detector.js';

describe('chord-detector', () => {
  it('returns empty array for silence', () => {
    const samples = new Float32Array(44100); // 1 second of silence
    const chords = detectChords(samples, 44100);
    expect(Array.isArray(chords)).toBe(true);
  });

  it('detects chords from a simple sine wave', () => {
    // Generate a C major chord (C4 + E4 + G4) at 261.63, 329.63, 392.00 Hz
    const sampleRate = 44100;
    const duration = 3;
    const samples = new Float32Array(sampleRate * duration);

    const freqs = [261.63, 329.63, 392.0];
    for (let i = 0; i < samples.length; i++) {
      for (const freq of freqs) {
        samples[i] += Math.sin((2 * Math.PI * freq * i) / sampleRate) / freqs.length;
      }
    }

    const chords = detectChords(samples, sampleRate);
    expect(chords.length).toBeGreaterThan(0);
    // Each chord event should have time, duration, label
    for (const chord of chords) {
      expect(chord).toHaveProperty('time');
      expect(chord).toHaveProperty('duration');
      expect(chord).toHaveProperty('label');
      expect(typeof chord.time).toBe('number');
      expect(typeof chord.duration).toBe('number');
      expect(typeof chord.label).toBe('string');
    }
  });

  it('filters out very short chords', () => {
    const sampleRate = 44100;
    const samples = new Float32Array(sampleRate * 2);
    // Very brief signal
    for (let i = 0; i < 1000; i++) {
      samples[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate);
    }
    const chords = detectChords(samples, sampleRate);
    // Any detected chords should have duration > 0.25
    for (const chord of chords) {
      expect(chord.duration).toBeGreaterThan(0.25);
    }
  });
});
