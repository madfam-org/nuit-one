import { describe, expect, it } from 'vitest';

// OfflineAudioContext is not available in vitest (no Web Audio API)
// Test the pure encoding helpers via the wav encoder
import { encodeWav } from './wav-encoder.js';

describe('exporter integration', () => {
  it('encodeWav produces correct size for stereo buffer', () => {
    const length = 44100;
    const channelData = [new Float32Array(length).fill(0), new Float32Array(length).fill(0)];
    const buffer = {
      numberOfChannels: 2,
      sampleRate: 44100,
      length,
      duration: 1,
      getChannelData: (ch: number) => channelData[ch]!,
    } as unknown as AudioBuffer;

    const blob = encodeWav(buffer);
    expect(blob.size).toBe(44 + 44100 * 2 * 2);
  });

  it('encodeWav returns audio/wav type', () => {
    const channelData = [new Float32Array(100).fill(0)];
    const buffer = {
      numberOfChannels: 1,
      sampleRate: 44100,
      length: 100,
      duration: 100 / 44100,
      getChannelData: (ch: number) => channelData[ch]!,
    } as unknown as AudioBuffer;

    const blob = encodeWav(buffer);
    expect(blob.type).toBe('audio/wav');
  });
});
