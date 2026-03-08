import { describe, it, expect } from 'vitest';
import { detectBPM } from './bpm-detector.js';

function createPulseBuffer(bpm: number, durationSec: number, sampleRate: number): AudioBuffer {
  const length = durationSec * sampleRate;
  const data = new Float32Array(length);
  const samplesPerBeat = (60 / bpm) * sampleRate;
  const pulseDuration = Math.floor(sampleRate * 0.01); // 10ms pulse

  for (let beat = 0; beat < durationSec * (bpm / 60); beat++) {
    const start = Math.floor(beat * samplesPerBeat);
    for (let j = 0; j < pulseDuration && start + j < length; j++) {
      data[start + j] = 0.8;
    }
  }

  return {
    numberOfChannels: 1,
    sampleRate,
    length,
    duration: durationSec,
    getChannelData: () => data,
  } as unknown as AudioBuffer;
}

describe('detectBPM', () => {
  it('detects 120 BPM from synthetic pulses', () => {
    const buffer = createPulseBuffer(120, 8, 44100);
    const detected = detectBPM(buffer);
    expect(detected).toBeGreaterThanOrEqual(115);
    expect(detected).toBeLessThanOrEqual(125);
  });

  it('detects 90 BPM from synthetic pulses', () => {
    const buffer = createPulseBuffer(90, 10, 44100);
    const detected = detectBPM(buffer);
    expect(detected).toBeGreaterThanOrEqual(85);
    expect(detected).toBeLessThanOrEqual(95);
  });

  it('detects 150 BPM from synthetic pulses', () => {
    const buffer = createPulseBuffer(150, 8, 44100);
    const detected = detectBPM(buffer);
    expect(detected).toBeGreaterThanOrEqual(145);
    expect(detected).toBeLessThanOrEqual(155);
  });

  it('returns a value in valid BPM range', () => {
    const buffer = createPulseBuffer(100, 5, 44100);
    const detected = detectBPM(buffer);
    expect(detected).toBeGreaterThanOrEqual(60);
    expect(detected).toBeLessThanOrEqual(200);
  });
});
