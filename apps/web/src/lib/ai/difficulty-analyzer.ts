import type { DifficultyTier, NoteEvent } from '@nuit-one/shared';

export interface DifficultyResult {
  tier: DifficultyTier;
  score: number; // 0-100
  factors: {
    noteDensity: number;
    pitchRange: number;
    intervalComplexity: number;
    rhythmicComplexity: number;
  };
}

/**
 * Analyze note events to determine difficulty tier.
 * Evaluates: note density, pitch range, interval complexity, rhythmic complexity.
 */
export function analyzeDifficulty(notes: NoteEvent[], durationSeconds: number): DifficultyResult {
  if (notes.length === 0) {
    return {
      tier: 'easy',
      score: 0,
      factors: { noteDensity: 0, pitchRange: 0, intervalComplexity: 0, rhythmicComplexity: 0 },
    };
  }

  // Note density (notes per second)
  const nps = notes.length / Math.max(1, durationSeconds);
  const noteDensity = Math.min(1, nps / 8); // 8 nps = max

  // Pitch range (MIDI range)
  const pitches = notes.map((n) => n.pitch);
  const minPitch = Math.min(...pitches);
  const maxPitch = Math.max(...pitches);
  const range = maxPitch - minPitch;
  const pitchRange = Math.min(1, range / 36); // 3 octaves = max

  // Interval complexity (average interval size)
  let totalInterval = 0;
  for (let i = 1; i < notes.length; i++) {
    totalInterval += Math.abs(notes[i]?.pitch - notes[i - 1]?.pitch);
  }
  const avgInterval = notes.length > 1 ? totalInterval / (notes.length - 1) : 0;
  const intervalComplexity = Math.min(1, avgInterval / 12); // octave = max

  // Rhythmic complexity (variance in note durations)
  const durations = notes.map((n) => n.duration);
  const avgDuration = durations.reduce((s, d) => s + d, 0) / durations.length;
  const durationVariance = durations.reduce((s, d) => s + (d - avgDuration) ** 2, 0) / durations.length;
  const rhythmicComplexity = Math.min(1, Math.sqrt(durationVariance) / 0.3);

  // Weighted score (0-100)
  const score = ((noteDensity * 35 + pitchRange * 20 + intervalComplexity * 25 + rhythmicComplexity * 20) * 100) / 100;

  let tier: DifficultyTier;
  if (score < 20) tier = 'easy';
  else if (score < 45) tier = 'medium';
  else if (score < 70) tier = 'hard';
  else tier = 'expert';

  return {
    tier,
    score: Math.round(score),
    factors: {
      noteDensity: Math.round(noteDensity * 100),
      pitchRange: Math.round(pitchRange * 100),
      intervalComplexity: Math.round(intervalComplexity * 100),
      rhythmicComplexity: Math.round(rhythmicComplexity * 100),
    },
  };
}
