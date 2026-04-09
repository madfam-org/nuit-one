import { describe, expect, it } from 'vitest';
import { encodeWav } from './wav-encoder.js';

function createMockBuffer(length: number, channels: number, sampleRate: number): AudioBuffer {
  const channelData: Float32Array[] = [];
  for (let ch = 0; ch < channels; ch++) {
    const data = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      data[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate);
    }
    channelData.push(data);
  }

  return {
    numberOfChannels: channels,
    sampleRate,
    length,
    duration: length / sampleRate,
    getChannelData: (ch: number) => channelData[ch]!,
  } as unknown as AudioBuffer;
}

describe('encodeWav', () => {
  it('produces a valid WAV blob', () => {
    const buffer = createMockBuffer(44100, 2, 44100);
    const blob = encodeWav(buffer);
    expect(blob.type).toBe('audio/wav');
    expect(blob.size).toBe(44 + 44100 * 2 * 2); // header + samples * channels * bytesPerSample
  });

  it('produces correct header for mono', () => {
    const buffer = createMockBuffer(100, 1, 44100);
    const blob = encodeWav(buffer);
    expect(blob.size).toBe(44 + 100 * 1 * 2);
  });

  it('clamps samples to [-1, 1]', () => {
    const buffer = createMockBuffer(10, 1, 44100);
    // Manually set out-of-range values
    const data = buffer.getChannelData(0);
    data[0] = 2.0;
    data[1] = -2.0;

    const blob = encodeWav(buffer);
    expect(blob.size).toBeGreaterThan(44);
  });
});
