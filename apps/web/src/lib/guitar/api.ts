/**
 * What the guitar practice page needs from the server: the web proxy routes under `/api/guitar` and
 * the shared job-status route. Kept apart from the page so the contract is explicit and testable
 * (every function takes `fetch` as an argument).
 *
 * - GET  /api/guitar/{trackId}  -> { performance: GuitarPerformance | null, available: boolean }
 * - POST /api/guitar/intake     -> { jobId } | 503 { message } when intake is not installed
 * - GET  /api/process/{jobId}   -> { status, progress, error? }
 */

import type { GuitarPerformance } from '@nuit-one/shared';
import { isGuitarPerformance } from './timeline.js';

type Fetch = typeof fetch;

export interface GuitarLookup {
  /** False when guitar intake is not installed on this server. */
  readonly available: boolean;
  readonly performance: GuitarPerformance | null;
}

export type JobPhase = 'queued' | 'downloading' | 'processing' | 'uploading' | 'complete' | 'error';

export interface JobStatus {
  readonly status: JobPhase;
  /** 0..100 */
  readonly progress: number;
  readonly error?: string;
}

export type IntakeStart =
  | { readonly ok: true; readonly jobId: string }
  | { readonly ok: false; readonly unavailable: boolean; readonly message: string };

const JOB_PHASES: readonly string[] = ['queued', 'downloading', 'processing', 'uploading', 'complete', 'error'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * The guitar transcription for a track, if there is one. Throws (with a message fit to show) when
 * the server cannot be reached or answers something that is not a guitar performance.
 */
export async function fetchGuitarPerformance(trackId: string, fetchFn: Fetch = fetch): Promise<GuitarLookup> {
  const res = await fetchFn(`/api/guitar/${encodeURIComponent(trackId)}`, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`The server answered ${res.status}.`);
  const body: unknown = await res.json();
  if (!isRecord(body)) throw new Error('The server sent something unexpected.');
  // `available` says whether this server can run a new intake; a stored transcription is shown
  // either way (it may have been produced elsewhere).
  const available = body.available !== false;
  const performance = body.performance ?? null;
  if (performance === null) return { available, performance: null };
  if (!isGuitarPerformance(performance)) throw new Error('This transcription is in a format the page cannot show.');
  return { available, performance };
}

/** Ask the server to transcribe the guitar part of a track. Never throws. */
export async function startGuitarIntake(trackId: string, fetchFn: Fetch = fetch): Promise<IntakeStart> {
  let res: Response;
  try {
    res = await fetchFn('/api/guitar/intake', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ trackId }),
    });
  } catch {
    return { ok: false, unavailable: false, message: 'Could not reach the server.' };
  }
  const body: unknown = await res.json().catch(() => null);
  if (res.ok) {
    const jobId = isRecord(body) ? body.jobId : undefined;
    if (typeof jobId === 'string' && jobId.length > 0) return { ok: true, jobId };
    return { ok: false, unavailable: false, message: 'The server did not start a job.' };
  }
  const message = isRecord(body) && typeof body.message === 'string' && body.message.length > 0 ? body.message : null;
  if (res.status === 503) {
    return { ok: false, unavailable: true, message: message ?? 'Guitar intake is not enabled on this server.' };
  }
  return { ok: false, unavailable: false, message: message ?? `The server answered ${res.status}.` };
}

/** One poll of a job. Null when this poll failed (try again later); never throws. */
export async function fetchJobStatus(jobId: string, fetchFn: Fetch = fetch): Promise<JobStatus | null> {
  try {
    const res = await fetchFn(`/api/process/${encodeURIComponent(jobId)}`, { headers: { accept: 'application/json' } });
    if (!res.ok) return null;
    const body: unknown = await res.json();
    if (!isRecord(body) || typeof body.status !== 'string' || !JOB_PHASES.includes(body.status)) return null;
    const progress = typeof body.progress === 'number' && Number.isFinite(body.progress) ? body.progress : 0;
    return {
      status: body.status as JobPhase,
      progress: Math.min(100, Math.max(0, progress)),
      error: typeof body.error === 'string' ? body.error : undefined,
    };
  } catch {
    return null;
  }
}

const JOB_LABELS: Readonly<Record<JobPhase, string>> = {
  queued: 'Waiting to start',
  downloading: 'Fetching the audio',
  processing: 'Listening to the guitar',
  uploading: 'Saving the transcription',
  complete: 'Done',
  error: 'Something went wrong',
};

/** A job phase in the words of the guitar transcription (not the stem splitter's). */
export function jobLabel(status: JobPhase): string {
  return JOB_LABELS[status];
}
