/**
 * Extract peak amplitude data from an AudioBuffer for waveform display.
 * Downsamples by computing max absolute value per pixel bucket.
 */
export function extractPeaks(buffer: AudioBuffer, samplesPerPixel: number): Float32Array {
  const channels = buffer.numberOfChannels;
  const length = buffer.length;
  const numBuckets = Math.ceil(length / samplesPerPixel);
  const peaks = new Float32Array(numBuckets);

  for (let ch = 0; ch < channels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < numBuckets; i++) {
      const start = i * samplesPerPixel;
      const end = Math.min(start + samplesPerPixel, length);
      let max = 0;
      for (let j = start; j < end; j++) {
        const abs = Math.abs(data[j]!);
        if (abs > max) max = abs;
      }
      // Take max across channels
      if (max > peaks[i]!) peaks[i] = max;
    }
  }

  return peaks;
}
