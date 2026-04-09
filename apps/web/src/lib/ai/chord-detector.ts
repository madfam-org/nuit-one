import type { ChordEvent } from '@nuit-one/shared';

// Major and minor triad templates (12 pitch classes)
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

/** Compute 12-bin chroma vector from a windowed PCM frame */
function computeChroma(samples: Float32Array, sampleRate: number): number[] {
  const chroma = new Array(12).fill(0);
  const n = samples.length;

  for (let bin = 1; bin < n / 2; bin++) {
    const freq = (bin * sampleRate) / n;
    if (freq < 65 || freq > 2000) continue;

    let real = 0;
    let imag = 0;
    for (let i = 0; i < n; i++) {
      const angle = (2 * Math.PI * bin * i) / n;
      real += samples[i]! * Math.cos(angle);
      imag -= samples[i]! * Math.sin(angle);
    }
    const magnitude = Math.sqrt(real * real + imag * imag);

    const midi = 12 * Math.log2(freq / 440) + 69;
    const chromaBin = ((Math.round(midi) % 12) + 12) % 12;
    chroma[chromaBin] += magnitude;
  }

  const max = Math.max(...chroma);
  if (max > 0) {
    for (let i = 0; i < 12; i++) chroma[i] /= max;
  }

  return chroma;
}

function matchChord(chroma: number[]): string {
  let best = 'N';
  let bestScore = -Infinity;

  for (const [name, template] of Object.entries(CHORD_TEMPLATES)) {
    let score = 0;
    for (let i = 0; i < 12; i++) {
      score += chroma[i]! * template[i]!;
    }
    if (score > bestScore) {
      bestScore = score;
      best = name;
    }
  }

  return best;
}

/**
 * Detect chords from PCM audio data.
 * Returns an array of ChordEvent objects.
 */
export function detectChords(
  samples: Float32Array,
  sampleRate: number,
  hopSeconds = 0.5,
  windowSeconds = 1.0,
): ChordEvent[] {
  const hopSize = Math.floor(sampleRate * hopSeconds);
  const frameSize = Math.min(4096, Math.floor(sampleRate * windowSeconds));
  const numFrames = Math.floor((samples.length - frameSize) / hopSize);

  const chords: ChordEvent[] = [];
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
        chords.push({ time, duration, label: lastChord });
      }
    }

    if (chord !== lastChord) {
      lastChord = chord;
      chordStart = offset;
    }
  }

  // Final chord
  if (lastChord) {
    const time = chordStart / sampleRate;
    const duration = (samples.length - chordStart) / sampleRate;
    if (duration > 0.25) {
      chords.push({ time, duration, label: lastChord });
    }
  }

  return chords;
}
