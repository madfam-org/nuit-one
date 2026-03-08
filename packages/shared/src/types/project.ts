import type { NoteEvent } from './game.js';

export type TrackStatus =
  | 'pending_upload' | 'uploaded' | 'processing' | 'ready' | 'error'
  | 'needs_parts' | 'in_progress' | 'delivered' | 'approved';

export type StemSource = 'upload' | 'recording' | 'demucs' | 'basic_pitch';

export type StemType = 'bass' | 'no_bass' | 'vocals' | 'drums' | 'other';

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
  readonly userId: string;
  readonly title: string;
  readonly instrument: string;
  readonly status: TrackStatus;
  readonly r2Key: string | null;
  readonly originalFilename: string | null;
  readonly fileSizeBytes: number | null;
  readonly contentType: string | null;
  readonly assignedTo: string | null;
  readonly sortOrder: number;
  readonly createdAt: string;
}

export interface Stem {
  readonly id: string;
  readonly trackId: string;
  readonly stemType: StemType;
  readonly r2Key: string;
  readonly fileSizeBytes: number | null;
  readonly durationSeconds: number | null;
  readonly sampleRate: number;
  readonly source: StemSource;
  readonly midiData: readonly NoteEvent[] | null;
  readonly createdBy: string;
  readonly createdAt: string;
}
