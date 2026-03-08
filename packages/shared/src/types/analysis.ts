export interface ChordEvent {
  time: number;
  duration: number;
  label: string;
}

export type DifficultyTier = 'easy' | 'medium' | 'hard' | 'expert';

export interface TrackAnalysis {
  readonly id: string;
  readonly trackId: string;
  readonly key: string | null;
  readonly bpmDetected: number | null;
  readonly chords: ChordEvent[] | null;
  readonly difficultyTier: DifficultyTier | null;
  readonly analysisVersion: string | null;
  readonly createdAt: Date;
}
