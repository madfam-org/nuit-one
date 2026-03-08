export interface BpmResult {
  bpm: number;
  confidence: number;
}

/**
 * Multi-method BPM detection with voting:
 * 1. Onset envelope autocorrelation
 * 2. Spectral flux
 * 3. Comb filter energy
 */
export function detectBpm(samples: Float32Array, sampleRate: number): BpmResult {
  const bpm1 = autocorrelationBpm(samples, sampleRate);
  const bpm2 = spectralFluxBpm(samples, sampleRate);
  const bpm3 = combFilterBpm(samples, sampleRate);

  // Voting: pick the BPM closest to the median
  const candidates = [bpm1, bpm2, bpm3].sort((a, b) => a - b);
  const median = candidates[1]!;

  // Weight by proximity to median
  let weightedSum = 0;
  let totalWeight = 0;
  for (const c of candidates) {
    const dist = Math.abs(c - median);
    const weight = 1 / (1 + dist);
    weightedSum += c * weight;
    totalWeight += weight;
  }

  const bpm = Math.round((weightedSum / totalWeight) * 10) / 10;

  // Confidence based on agreement
  const spread = candidates[2]! - candidates[0]!;
  const confidence = Math.max(0, 1 - spread / 60);

  return { bpm, confidence };
}

function autocorrelationBpm(samples: Float32Array, sampleRate: number): number {
  const frameSize = 1024;
  const hopSize = 512;
  const numFrames = Math.floor((samples.length - frameSize) / hopSize);
  if (numFrames < 2) return 120;

  // Onset envelope
  const envelope = new Float32Array(numFrames);
  let prevEnergy = 0;
  for (let f = 0; f < numFrames; f++) {
    let energy = 0;
    const offset = f * hopSize;
    for (let i = 0; i < frameSize; i++) {
      energy += samples[offset + i]! * samples[offset + i]!;
    }
    envelope[f] = Math.max(0, energy - prevEnergy);
    prevEnergy = energy;
  }

  // Autocorrelation
  const minLag = Math.floor((60 / 200) * sampleRate / hopSize);
  const maxLag = Math.floor((60 / 60) * sampleRate / hopSize);

  let bestLag = minLag;
  let bestCorr = -Infinity;

  for (let lag = minLag; lag <= Math.min(maxLag, numFrames - 1); lag++) {
    let corr = 0;
    let count = 0;
    for (let i = 0; i < numFrames - lag; i++) {
      corr += envelope[i]! * envelope[i + lag]!;
      count++;
    }
    corr /= count || 1;
    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }

  return 60 / ((bestLag * hopSize) / sampleRate);
}

function spectralFluxBpm(samples: Float32Array, sampleRate: number): number {
  const frameSize = 2048;
  const hopSize = 512;
  const numFrames = Math.floor((samples.length - frameSize) / hopSize);
  if (numFrames < 4) return 120;

  // Compute spectral flux
  const flux = new Float32Array(numFrames);
  let prevSpectrum: number[] = [];

  for (let f = 0; f < numFrames; f++) {
    const offset = f * hopSize;
    const spectrum: number[] = [];

    // Simple magnitude spectrum (few bins)
    const numBins = 32;
    for (let bin = 1; bin <= numBins; bin++) {
      let real = 0;
      let imag = 0;
      for (let i = 0; i < frameSize; i++) {
        const angle = (2 * Math.PI * bin * i) / frameSize;
        real += samples[offset + i]! * Math.cos(angle);
        imag -= samples[offset + i]! * Math.sin(angle);
      }
      spectrum.push(Math.sqrt(real * real + imag * imag));
    }

    if (prevSpectrum.length > 0) {
      let sf = 0;
      for (let i = 0; i < numBins; i++) {
        const diff = spectrum[i]! - prevSpectrum[i]!;
        sf += Math.max(0, diff);
      }
      flux[f] = sf;
    }

    prevSpectrum = spectrum;
  }

  // Autocorrelation on flux
  const minLag = Math.floor((60 / 200) * sampleRate / hopSize);
  const maxLag = Math.floor((60 / 60) * sampleRate / hopSize);

  let bestLag = minLag;
  let bestCorr = -Infinity;

  for (let lag = minLag; lag <= Math.min(maxLag, numFrames - 1); lag++) {
    let corr = 0;
    let count = 0;
    for (let i = 0; i < numFrames - lag; i++) {
      corr += flux[i]! * flux[i + lag]!;
      count++;
    }
    corr /= count || 1;
    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }

  return 60 / ((bestLag * hopSize) / sampleRate);
}

function combFilterBpm(samples: Float32Array, sampleRate: number): number {
  // Test BPMs from 60 to 200 in steps of 1
  let bestBpm = 120;
  let bestEnergy = -Infinity;

  for (let bpm = 60; bpm <= 200; bpm++) {
    const period = Math.floor((60 / bpm) * sampleRate);
    let energy = 0;
    let count = 0;

    // Sum correlation at this period
    for (let i = 0; i < samples.length - period; i += period) {
      const maxJ = Math.min(i + period, samples.length);
      let frameEnergy = 0;
      for (let j = i; j < maxJ && j + period < samples.length; j += 256) {
        frameEnergy += samples[j]! * samples[j + period]!;
      }
      energy += frameEnergy;
      count++;
    }

    energy /= count || 1;
    if (energy > bestEnergy) {
      bestEnergy = energy;
      bestBpm = bpm;
    }
  }

  return bestBpm;
}
