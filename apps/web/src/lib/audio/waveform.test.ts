import { describe, it, expect } from 'vitest';
import { extractPeaks } from './waveform.js';

function createBuffer(data: Float32Array, channels = 1, sampleRate = 44100): AudioBuffer {
  return {
    numberOfChannels: channels,
    sampleRate,
    length: data.length,
    duration: data.length / sampleRate,
    getChannelData: () => data,
  } as unknown as AudioBuffer;
}

describe('extractPeaks', () => {
  it('returns correct number of buckets', () => {
    const data = new Float32Array(1000);
    const buffer = createBuffer(data);
    const peaks = extractPeaks(buffer, 100);
    expect(peaks.length).toBe(10);
  });

  it('finds peak amplitude per bucket', () => {
    const data = new Float32Array(200);
    data[50] = 0.8; // peak in first bucket
    data[150] = -0.6; // peak in second bucket (absolute)
    const buffer = createBuffer(data);
    const peaks = extractPeaks(buffer, 100);
    expect(peaks[0]).toBeCloseTo(0.8);
    expect(peaks[1]).toBeCloseTo(0.6);
  });

  it('returns zeros for silent audio', () => {
    const data = new Float32Array(500);
    const buffer = createBuffer(data);
    const peaks = extractPeaks(buffer, 100);
    for (let i = 0; i < peaks.length; i++) {
      expect(peaks[i]).toBe(0);
    }
  });

  it('handles non-divisible length', () => {
    const data = new Float32Array(150);
    data[120] = 0.5;
    const buffer = createBuffer(data);
    const peaks = extractPeaks(buffer, 100);
    // ceil(150/100) = 2 buckets
    expect(peaks.length).toBe(2);
    expect(peaks[1]).toBeCloseTo(0.5);
  });

  it('takes max across channels for stereo', () => {
    const left = new Float32Array(100);
    const right = new Float32Array(100);
    left[10] = 0.3;
    right[10] = 0.9;
    let callCount = 0;
    const buffer = {
      numberOfChannels: 2,
      sampleRate: 44100,
      length: 100,
      duration: 100 / 44100,
      getChannelData: () => {
        return callCount++ === 0 ? left : right;
      },
    } as unknown as AudioBuffer;
    const peaks = extractPeaks(buffer, 100);
    expect(peaks[0]).toBeCloseTo(0.9);
  });
});
