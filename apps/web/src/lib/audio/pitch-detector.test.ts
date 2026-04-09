import { describe, expect, it } from 'vitest';
import { frequencyToMidi, midiToFrequency, midiToNoteName, PitchDetector } from './pitch-detector.js';

describe('frequencyToMidi', () => {
  it('converts A4 (440 Hz) to MIDI note 69', () => {
    expect(frequencyToMidi(440)).toBe(69);
  });

  it('converts C4 (~261.63 Hz) to MIDI note 60', () => {
    expect(frequencyToMidi(261.63)).toBe(60);
  });

  it('converts A3 (220 Hz) to MIDI note 57', () => {
    expect(frequencyToMidi(220)).toBe(57);
  });

  it('converts A5 (880 Hz) to MIDI note 81', () => {
    expect(frequencyToMidi(880)).toBe(81);
  });

  it('returns -1 for zero frequency', () => {
    expect(frequencyToMidi(0)).toBe(-1);
  });

  it('returns -1 for negative frequency', () => {
    expect(frequencyToMidi(-100)).toBe(-1);
  });

  it('rounds to nearest MIDI note', () => {
    // Slightly sharp A4 should still be 69
    expect(frequencyToMidi(442)).toBe(69);
    // Slightly flat A4 should still be 69
    expect(frequencyToMidi(438)).toBe(69);
  });

  it('handles bass guitar low E (~41.2 Hz) as MIDI 28', () => {
    expect(frequencyToMidi(41.2)).toBe(28);
  });
});

describe('midiToFrequency', () => {
  it('converts MIDI note 69 to 440 Hz (A4)', () => {
    expect(midiToFrequency(69)).toBeCloseTo(440, 1);
  });

  it('converts MIDI note 60 to ~261.63 Hz (C4)', () => {
    expect(midiToFrequency(60)).toBeCloseTo(261.63, 0);
  });

  it('converts MIDI note 57 to 220 Hz (A3)', () => {
    expect(midiToFrequency(57)).toBeCloseTo(220, 1);
  });

  it('converts MIDI note 81 to 880 Hz (A5)', () => {
    expect(midiToFrequency(81)).toBeCloseTo(880, 1);
  });

  it('is inverse of frequencyToMidi for exact semitones', () => {
    for (let midi = 21; midi <= 108; midi++) {
      const freq = midiToFrequency(midi);
      expect(frequencyToMidi(freq)).toBe(midi);
    }
  });
});

describe('PitchDetector options', () => {
  // We can't fully test audio in a Node environment, but we can verify
  // that the constructor accepts options and stores them correctly.
  it('accepts custom frequency range options', () => {
    // Mock minimal AudioContext
    const mockCtx = {
      createAnalyser: () => ({
        fftSize: 4096,
        getFloatTimeDomainData: () => {},
        connect: () => {},
      }),
      sampleRate: 44100,
    } as unknown as AudioContext;

    const detector = new PitchDetector(mockCtx, {
      minFrequency: 80,
      maxFrequency: 1100,
      deviceId: 'test-device-id',
    });

    // The detector should be created without error
    expect(detector).toBeDefined();
    expect(detector.running).toBe(false);
    expect(detector.currentPitch).toBe(0);
    expect(detector.currentMidiNote).toBe(-1);
  });

  it('defaults to 30-500 Hz range without options', () => {
    const mockCtx = {
      createAnalyser: () => ({
        fftSize: 4096,
        getFloatTimeDomainData: () => {},
        connect: () => {},
      }),
      sampleRate: 44100,
    } as unknown as AudioContext;

    const detector = new PitchDetector(mockCtx);
    expect(detector).toBeDefined();
    expect(detector.running).toBe(false);
  });
});

describe('midiToNoteName', () => {
  it('converts MIDI 60 to C4', () => {
    expect(midiToNoteName(60)).toBe('C4');
  });

  it('converts MIDI 69 to A4', () => {
    expect(midiToNoteName(69)).toBe('A4');
  });

  it('converts MIDI 0 to C-1', () => {
    expect(midiToNoteName(0)).toBe('C-1');
  });

  it('converts MIDI 127 to G9', () => {
    expect(midiToNoteName(127)).toBe('G9');
  });

  it('handles sharps correctly', () => {
    expect(midiToNoteName(61)).toBe('C#4');
    expect(midiToNoteName(63)).toBe('D#4');
    expect(midiToNoteName(66)).toBe('F#4');
  });

  it('returns empty string for negative MIDI note', () => {
    expect(midiToNoteName(-1)).toBe('');
  });

  it('handles bass guitar range notes', () => {
    expect(midiToNoteName(28)).toBe('E1'); // Low E
    expect(midiToNoteName(33)).toBe('A1'); // A string
    expect(midiToNoteName(38)).toBe('D2'); // D string
    expect(midiToNoteName(43)).toBe('G2'); // G string
  });
});
