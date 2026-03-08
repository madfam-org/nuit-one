import type { NoteEvent, PerformanceResult, HitJudgment } from '@nuit-one/shared';
import { HIT_WINDOWS, HIT_SCORES } from '@nuit-one/shared';

export interface NoteJudgment {
  noteIndex: number;
  judgment: HitJudgment;
  timingOffsetMs: number;
  pitchOffsetSemitones: number;
}

export class ScoringEngine {
  private notes: NoteEvent[];
  private judgments: NoteJudgment[] = [];
  private _combo = 0;
  private _maxCombo = 0;
  private _totalScore = 0;
  private hitNotes = new Set<number>();

  constructor(notes: NoteEvent[]) {
    this.notes = [...notes].sort((a, b) => a.startTime - b.startTime);
  }

  /**
   * Evaluate a detected pitch at a given time against expected notes.
   * Returns a judgment if a note was hit, null otherwise.
   */
  evaluate(currentTime: number, detectedMidiNote: number): NoteJudgment | null {
    if (detectedMidiNote < 0) return null;

    // Find the closest unhit note within timing window
    let bestIdx = -1;
    let bestTiming = Infinity;

    for (let i = 0; i < this.notes.length; i++) {
      if (this.hitNotes.has(i)) continue;

      const note = this.notes[i]!;
      const noteCenter = note.startTime + note.duration / 2;
      const timingMs = Math.abs(currentTime - noteCenter) * 1000;

      // Skip notes outside the largest window
      if (timingMs > HIT_WINDOWS.good) continue;

      // Check pitch match (within 1 semitone for "hit")
      const pitchDiff = Math.abs(detectedMidiNote - note.pitch);
      if (pitchDiff > 2) continue;

      if (timingMs < bestTiming) {
        bestTiming = timingMs;
        bestIdx = i;
      }
    }

    if (bestIdx < 0) return null;

    const note = this.notes[bestIdx]!;
    const timingMs = Math.abs(currentTime - (note.startTime + note.duration / 2)) * 1000;
    const pitchDiff = Math.abs(detectedMidiNote - note.pitch);

    // Determine judgment
    let judgment: HitJudgment;
    if (timingMs <= HIT_WINDOWS.perfect && pitchDiff === 0) {
      judgment = 'perfect';
    } else if (timingMs <= HIT_WINDOWS.great && pitchDiff <= 1) {
      judgment = 'great';
    } else if (timingMs <= HIT_WINDOWS.good) {
      judgment = 'good';
    } else {
      judgment = 'miss';
    }

    this.hitNotes.add(bestIdx);

    const result: NoteJudgment = {
      noteIndex: bestIdx,
      judgment,
      timingOffsetMs: timingMs,
      pitchOffsetSemitones: pitchDiff,
    };

    this.applyScore(result);
    this.judgments.push(result);
    return result;
  }

  /**
   * Check for missed notes that have passed the timing window.
   */
  checkMisses(currentTime: number): NoteJudgment[] {
    const misses: NoteJudgment[] = [];

    for (let i = 0; i < this.notes.length; i++) {
      if (this.hitNotes.has(i)) continue;

      const note = this.notes[i]!;
      const noteEnd = note.startTime + note.duration;
      const timePast = (currentTime - noteEnd) * 1000;

      if (timePast > HIT_WINDOWS.good) {
        this.hitNotes.add(i);
        const miss: NoteJudgment = {
          noteIndex: i,
          judgment: 'miss',
          timingOffsetMs: timePast,
          pitchOffsetSemitones: 0,
        };
        this._combo = 0;
        this.judgments.push(miss);
        misses.push(miss);
      }
    }

    return misses;
  }

  private applyScore(j: NoteJudgment): void {
    const points = HIT_SCORES[j.judgment];
    if (j.judgment !== 'miss') {
      this._combo++;
      if (this._combo > this._maxCombo) this._maxCombo = this._combo;
    } else {
      this._combo = 0;
    }

    // Combo multiplier: 1x for 0-9, 2x for 10-24, 3x for 25-49, 4x for 50+
    const multiplier = this._combo < 10 ? 1 : this._combo < 25 ? 2 : this._combo < 50 ? 3 : 4;
    this._totalScore += points * multiplier;
  }

  get combo(): number { return this._combo; }
  get maxCombo(): number { return this._maxCombo; }
  get totalScore(): number { return this._totalScore; }
  get totalNotes(): number { return this.notes.length; }
  get hitCount(): number { return this.hitNotes.size; }

  getResults(): PerformanceResult {
    const counts = { perfect: 0, great: 0, good: 0, miss: 0 };
    for (const j of this.judgments) {
      counts[j.judgment]++;
    }

    // Count remaining unhit notes as misses
    const unmissed = this.notes.length - this.hitNotes.size;
    counts.miss += unmissed;

    const total = this.notes.length;
    const accuracy = total > 0
      ? ((counts.perfect * 100 + counts.great * 75 + counts.good * 50) / (total * 100)) * 100
      : 0;

    return {
      totalScore: this._totalScore,
      maxCombo: this._maxCombo,
      perfectCount: counts.perfect,
      greatCount: counts.great,
      goodCount: counts.good,
      missCount: counts.miss,
      accuracy: Math.round(accuracy * 10) / 10,
    };
  }
}
