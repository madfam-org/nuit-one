import type { ChordEvent } from '@nuit-one/shared';

export const ANALYSIS_VERSION = '1.0.0';

// Major chord templates (root, 3rd, 5th positions in chroma)
const CHORD_TEMPLATES: Record<string, number[]> = {
  C: [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0],
  'C#': [0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0],
  D: [0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0],
  'D#': [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0],
  E: [0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1],
  F: [1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0],
  'F#': [0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0],
  G: [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1],
  'G#': [1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0],
  A: [0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
  'A#': [0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0],
  B: [0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1],
  Cm: [1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0],
  'C#m': [0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
  Dm: [0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0],
  'D#m': [0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0],
  Em: [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1],
  Fm: [1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0],
  'F#m': [0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0],
  Gm: [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1],
  'G#m': [1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0],
  Am: [0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
  'A#m': [0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0],
  Bm: [0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1],
};

// Krumhansl-Schmuckler key profiles
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export interface AnalysisResult {
  chords: ChordEvent[];
  key: string;
  bpm: number;
}

/**
 * Compute chroma vector from PCM audio data for a single frame.
 * Uses DFT bins mapped to pitch classes.
 */
function computeChroma(samples: Float32Array, sampleRate: number): number[] {
  const chroma = new Array(12).fill(0) as number[];
  const fftSize = 4096;
  const n = Math.min(samples.length, fftSize);

  for (let bin = 1; bin < n / 2; bin++) {
    const freq = (bin * sampleRate) / n;
    if (freq < 65 || freq > 2000) continue; // Focus on harmonic range

    // Compute magnitude for this bin via DFT
    let real = 0;
    let imag = 0;
    for (let i = 0; i < n; i++) {
      const angle = (2 * Math.PI * bin * i) / n;
      real += samples[i]! * Math.cos(angle);
      imag -= samples[i]! * Math.sin(angle);
    }
    const magnitude = Math.sqrt(real * real + imag * imag);

    // Map frequency to chroma bin
    const midi = 12 * Math.log2(freq / 440) + 69;
    const chromaBin = Math.round(midi) % 12;
    if (chromaBin >= 0 && chromaBin < 12) {
      chroma[chromaBin] = chroma[chromaBin]! + magnitude;
    }
  }

  // Normalize
  const max = Math.max(...chroma);
  if (max > 0) {
    for (let i = 0; i < 12; i++) chroma[i] = chroma[i]! / max;
  }

  return chroma;
}

/** Match a chroma vector against chord templates, returning the best chord label. */
function matchChord(chroma: number[]): string {
  let bestChord = 'N';
  let bestScore = -Infinity;

  for (const [name, template] of Object.entries(CHORD_TEMPLATES)) {
    let score = 0;
    for (let i = 0; i < 12; i++) {
      score += chroma[i]! * template[i]!;
    }
    if (score > bestScore) {
      bestScore = score;
      bestChord = name;
    }
  }

  return bestChord;
}

/** Detect musical key using Krumhansl-Schmuckler algorithm on chord distribution. */
function detectKey(chordCounts: Record<string, number>): string {
  // Build chroma profile from chord root distribution
  const chromaProfile = new Array(12).fill(0) as number[];
  for (const [chord, count] of Object.entries(chordCounts)) {
    const isMinor = chord.endsWith('m');
    const root = isMinor ? chord.slice(0, -1) : chord;
    const rootIdx = NOTE_NAMES.indexOf(root);
    if (rootIdx >= 0) {
      chromaProfile[rootIdx] = chromaProfile[rootIdx]! + count;
    }
  }

  let bestKey = 'C major';
  let bestCorr = -Infinity;

  for (let shift = 0; shift < 12; shift++) {
    const rotated = rotateArray(chromaProfile, shift);

    // Try major key
    const corrMajor = pearsonCorrelation(rotated, MAJOR_PROFILE);
    if (corrMajor > bestCorr) {
      bestCorr = corrMajor;
      bestKey = `${NOTE_NAMES[shift]} major`;
    }

    // Try minor key
    const corrMinor = pearsonCorrelation(rotated, MINOR_PROFILE);
    if (corrMinor > bestCorr) {
      bestCorr = corrMinor;
      bestKey = `${NOTE_NAMES[shift]} minor`;
    }
  }

  return bestKey;
}

function pearsonCorrelation(a: number[], b: number[]): number {
  const n = a.length;
  const meanA = a.reduce((s, v) => s + v, 0) / n;
  const meanB = b.reduce((s, v) => s + v, 0) / n;

  let num = 0;
  let denA = 0;
  let denB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i]! - meanA;
    const db = b[i]! - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }

  const den = Math.sqrt(denA * denB);
  return den === 0 ? 0 : num / den;
}

function rotateArray(arr: number[], shift: number): number[] {
  const n = arr.length;
  return arr.map((_, i) => arr[(i + shift) % n]!);
}

/** Detect BPM from audio using onset envelope autocorrelation. */
function detectBpm(samples: Float32Array, sampleRate: number): number {
  const frameSize = 1024;
  const hopSize = 512;
  const numFrames = Math.floor((samples.length - frameSize) / hopSize);

  if (numFrames < 2) return 120; // default fallback

  // Compute onset envelope (spectral flux)
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

  // Autocorrelation on onset envelope
  const minLag = Math.floor(((60 / 200) * sampleRate) / hopSize); // 200 BPM max
  const maxLag = Math.floor(((60 / 60) * sampleRate) / hopSize); // 60 BPM min

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

  const bpm = 60 / ((bestLag * hopSize) / sampleRate);
  return Math.round(bpm * 10) / 10;
}

/**
 * Analyze audio samples for chord progression, musical key, and BPM.
 *
 * @param samples - Mono PCM float samples in [-1, 1] range
 * @param sampleRate - Sample rate in Hz (e.g. 44100)
 * @returns Detected chords, key, and BPM
 */
export function analyzeAudio(samples: Float32Array, sampleRate: number): AnalysisResult {
  const hopSize = Math.floor(sampleRate * 0.5); // 0.5-second hop for chord detection
  const frameSize = Math.floor(sampleRate * 1.0); // 1-second analysis window
  const numFrames = Math.floor((samples.length - frameSize) / hopSize);

  const chords: ChordEvent[] = [];
  const chordCounts: Record<string, number> = {};
  let lastChord = '';
  let chordStart = 0;

  for (let f = 0; f <= numFrames; f++) {
    const offset = f * hopSize;
    const frame = samples.slice(offset, offset + frameSize);
    const chroma = computeChroma(frame, sampleRate);
    const chord = matchChord(chroma);

    if (chord !== lastChord && lastChord) {
      const time = chordStart / sampleRate;
      const duration = (f * hopSize - chordStart) / sampleRate;
      if (duration > 0.25) {
        // Filter out very short chord detections
        chords.push({ time, duration, label: lastChord });
        chordCounts[lastChord] = (chordCounts[lastChord] || 0) + 1;
      }
    }

    if (chord !== lastChord) {
      lastChord = chord;
      chordStart = offset;
    }
  }

  // Add final chord segment
  if (lastChord) {
    const time = chordStart / sampleRate;
    const duration = (samples.length - chordStart) / sampleRate;
    if (duration > 0.25) {
      chords.push({ time, duration, label: lastChord });
      chordCounts[lastChord] = (chordCounts[lastChord] || 0) + 1;
    }
  }

  const key = detectKey(chordCounts);
  const bpm = detectBpm(samples, sampleRate);

  return { chords, key, bpm };
}

/**
 * Parse a WAV file buffer into mono Float32Array samples.
 * Supports 16-bit and 24-bit PCM WAV files.
 *
 * @param buffer - Raw WAV file bytes
 * @returns Tuple of [samples, sampleRate]
 */
export function parseWav(buffer: Buffer): [Float32Array, number] {
  // Validate RIFF header
  const riff = buffer.toString('ascii', 0, 4);
  const wave = buffer.toString('ascii', 8, 12);
  if (riff !== 'RIFF' || wave !== 'WAVE') {
    throw new Error('Invalid WAV file: missing RIFF/WAVE header');
  }

  // Find fmt chunk
  let offset = 12;
  let sampleRate = 44100;
  let numChannels = 1;
  let bitsPerSample = 16;

  while (offset < buffer.length - 8) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);

    if (chunkId === 'fmt ') {
      numChannels = buffer.readUInt16LE(offset + 10);
      sampleRate = buffer.readUInt32LE(offset + 12);
      bitsPerSample = buffer.readUInt16LE(offset + 22);
    }

    if (chunkId === 'data') {
      const dataStart = offset + 8;
      const dataEnd = dataStart + chunkSize;
      const bytesPerSample = bitsPerSample / 8;
      const totalSamples = Math.floor(chunkSize / (bytesPerSample * numChannels));

      // Mix down to mono
      const samples = new Float32Array(totalSamples);

      for (let i = 0; i < totalSamples; i++) {
        let sum = 0;
        for (let ch = 0; ch < numChannels; ch++) {
          const byteOffset = dataStart + (i * numChannels + ch) * bytesPerSample;
          if (byteOffset + bytesPerSample > dataEnd) break;

          let value: number;
          if (bitsPerSample === 16) {
            value = buffer.readInt16LE(byteOffset) / 32768;
          } else if (bitsPerSample === 24) {
            // Read 24-bit signed integer
            const lo = buffer.readUInt16LE(byteOffset);
            const hi = buffer.readInt8(byteOffset + 2);
            value = ((hi << 16) | lo) / 8388608;
          } else {
            // Fallback: treat as 16-bit
            value = buffer.readInt16LE(byteOffset) / 32768;
          }
          sum += value;
        }
        samples[i] = sum / numChannels;
      }

      return [samples, sampleRate];
    }

    offset += 8 + chunkSize;
    // WAV chunks are word-aligned
    if (chunkSize % 2 !== 0) offset++;
  }

  throw new Error('Invalid WAV file: no data chunk found');
}
