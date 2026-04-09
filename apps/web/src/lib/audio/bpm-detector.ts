/**
 * Detect BPM from an AudioBuffer using energy-based onset detection + autocorrelation.
 * Works best for rhythmic music (rock, pop, funk, etc.).
 */
export function detectBPM(buffer: AudioBuffer): number {
  // Downsample to mono at ~11kHz for analysis speed
  const downFactor = Math.max(1, Math.floor(buffer.sampleRate / 11025));
  const sampleRate = buffer.sampleRate / downFactor;
  const mono = downsampleToMono(buffer, downFactor);

  // Onset envelope (one value per hop frame)
  const frameSize = Math.floor(sampleRate * 0.02); // 20ms frames
  const hopSize = Math.floor(frameSize / 2);
  const envelope = computeOnsetEnvelope(mono, sampleRate, frameSize, hopSize);

  // Autocorrelation to find periodicity — lags in frame units
  const onsetRate = sampleRate / hopSize; // frames per second
  const minLag = Math.floor((60 / 200) * onsetRate); // 200 BPM
  const maxLag = Math.floor((60 / 60) * onsetRate); // 60 BPM

  const correlation = autocorrelate(envelope, minLag, maxLag);

  // Find peak
  let bestLag = minLag;
  let bestValue = -Infinity;
  for (let lag = minLag; lag <= maxLag && lag < correlation.length; lag++) {
    if (correlation[lag]! > bestValue) {
      bestValue = correlation[lag]!;
      bestLag = lag;
    }
  }

  const bpm = (60 * onsetRate) / bestLag;
  return Math.round(bpm);
}

function downsampleToMono(buffer: AudioBuffer, factor: number): Float32Array {
  const channels = buffer.numberOfChannels;
  const srcLength = buffer.length;
  const dstLength = Math.floor(srcLength / factor);
  const mono = new Float32Array(dstLength);

  for (let ch = 0; ch < channels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < dstLength; i++) {
      mono[i]! += data[i * factor]! / channels;
    }
  }

  return mono;
}

function computeOnsetEnvelope(
  samples: Float32Array,
  _sampleRate: number,
  frameSize: number,
  hopSize: number,
): Float32Array {
  const numFrames = Math.floor((samples.length - frameSize) / hopSize);
  const envelope = new Float32Array(numFrames);

  for (let i = 0; i < numFrames; i++) {
    const start = i * hopSize;
    let energy = 0;
    for (let j = 0; j < frameSize; j++) {
      energy += samples[start + j]! * samples[start + j]!;
    }
    envelope[i] = energy;
  }

  // Half-wave rectified first derivative (onset strength)
  const onset = new Float32Array(numFrames);
  for (let i = 1; i < numFrames; i++) {
    const diff = envelope[i]! - envelope[i - 1]!;
    onset[i] = diff > 0 ? diff : 0;
  }

  return onset;
}

function autocorrelate(signal: Float32Array, minLag: number, maxLag: number): Float32Array {
  const n = signal.length;
  const result = new Float32Array(maxLag + 1);

  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < n - lag; i++) {
      sum += signal[i]! * signal[i + lag]!;
    }
    result[lag] = sum;
  }

  return result;
}
