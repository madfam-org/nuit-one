import type { ChordEvent } from '@nuit-one/shared';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Krumhansl-Schmuckler key profiles
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

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

export interface KeyResult {
  key: string;
  confidence: number;
}

/**
 * Detect musical key from chord distribution using Krumhansl-Schmuckler algorithm.
 */
export function detectKey(chords: ChordEvent[]): KeyResult {
  // Build chroma profile from chord roots
  const chromaProfile = new Array(12).fill(0) as number[];
  for (const chord of chords) {
    const isMinor = chord.label.endsWith('m');
    const root = isMinor ? chord.label.slice(0, -1) : chord.label;
    const rootIdx = NOTE_NAMES.indexOf(root);
    if (rootIdx >= 0) {
      // Weight by chord duration
      chromaProfile[rootIdx] += chord.duration;
    }
  }

  let bestKey = 'C major';
  let bestCorr = -Infinity;

  for (let shift = 0; shift < 12; shift++) {
    const rotated = rotateArray(chromaProfile, shift);

    const corrMajor = pearsonCorrelation(rotated, MAJOR_PROFILE);
    if (corrMajor > bestCorr) {
      bestCorr = corrMajor;
      bestKey = `${NOTE_NAMES[shift]} major`;
    }

    const corrMinor = pearsonCorrelation(rotated, MINOR_PROFILE);
    if (corrMinor > bestCorr) {
      bestCorr = corrMinor;
      bestKey = `${NOTE_NAMES[shift]} minor`;
    }
  }

  return { key: bestKey, confidence: Math.max(0, bestCorr) };
}
