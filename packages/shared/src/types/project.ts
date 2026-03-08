import type { SampleRate } from './audio.js';

export type TrackStatus = 'needs_parts' | 'in_progress' | 'delivered' | 'approved';

export type StemSource = 'upload' | 'recording' | 'demucs' | 'basic_pitch';

export interface Project {
  readonly id: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly tempoBpm: number;
  readonly timeSignature: string;
  readonly createdBy: string;
  readonly createdAt: string;
}

export interface Track {
  readonly id: string;
  readonly projectId: string;
  readonly instrument: string;
  readonly status: TrackStatus;
  readonly assignedTo: string | null;
  readonly sortOrder: number;
  readonly createdAt: string;
}

export interface Stem {
  readonly id: string;
  readonly trackId: string;
  readonly r2Key: string;
  readonly fileSizeBytes: number;
  readonly durationSeconds: number;
  readonly sampleRate: SampleRate;
  readonly source: StemSource;
  readonly createdBy: string;
  readonly createdAt: string;
}
