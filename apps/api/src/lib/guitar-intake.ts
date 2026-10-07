import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { updateJob } from './job-manager.js';
import { uploadFile } from './storage.js';

/**
 * Guitar intake: runs the `nuit-transcribe` engine (apps/transcriber) on a source URL or media
 * file and stores its outputs next to the track's content.
 *
 * The engine is optional per deployment. `NUIT_TRANSCRIBER_BIN` points at the executable (default:
 * `nuit-transcribe` on PATH); when it cannot be run, the intake endpoints answer 503 rather than
 * failing a job halfway.
 */

export const GUITAR_OUTPUTS = [
  { file: 'performance.json', contentType: 'application/json' },
  { file: 'performance.musicxml', contentType: 'application/vnd.recordare.musicxml+xml' },
  { file: 'performance.mid', contentType: 'audio/midi' },
  { file: 'chart.json', contentType: 'application/json' },
] as const;

export function transcriberBin(): string {
  return process.env.NUIT_TRANSCRIBER_BIN || 'nuit-transcribe';
}

let availability: Promise<boolean> | null = null;

/** Whether the engine can be executed here (checked once per process with `--version`). */
export function transcriberAvailable(): Promise<boolean> {
  if (!availability) {
    availability = new Promise<boolean>((resolve) => {
      let settled = false;
      const done = (ok: boolean) => {
        if (!settled) {
          settled = true;
          resolve(ok);
        }
      };
      try {
        const proc = spawn(transcriberBin(), ['--version'], { stdio: ['ignore', 'pipe', 'ignore'] });
        const timer = setTimeout(() => {
          proc.kill();
          done(false);
        }, 15_000);
        proc.on('error', () => {
          clearTimeout(timer);
          done(false);
        });
        proc.on('close', (code) => {
          clearTimeout(timer);
          done(code === 0);
        });
      } catch {
        done(false);
      }
    });
  }
  return availability;
}

/** Test hook: forget the cached availability check. */
export function resetTranscriberAvailability(): void {
  availability = null;
}

/** Storage prefix for a track's guitar outputs: next to imported content, else under the track. */
export function guitarPrefix(trackId: string, contentSourceId: string | null | undefined): string {
  return contentSourceId ? `content/${contentSourceId}/guitar` : `tracks/${trackId}/guitar`;
}

export interface ProgressLine {
  stage: string;
  progress: number;
  error?: string;
}

/** Parse one line of `--progress json` output; non-JSON lines are ignored. */
export function parseProgressLine(line: string): ProgressLine | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('{')) return null;
  try {
    const value = JSON.parse(trimmed) as Partial<ProgressLine>;
    if (typeof value.stage !== 'string' || typeof value.progress !== 'number') return null;
    return { stage: value.stage, progress: value.progress, error: value.error };
  } catch {
    return null;
  }
}

/** Map engine progress (0..1) onto the job's 5..90 % band; storage upload takes the rest. */
export function jobProgress(engineProgress: number): number {
  const clamped = Math.min(Math.max(engineProgress, 0), 1);
  return Math.round(5 + clamped * 85);
}

export async function runGuitarIntake(jobId: string, source: string, prefix: string): Promise<string[]> {
  const outDir = await mkdtemp(join(tmpdir(), 'nuit-guitar-'));
  const cacheDir = process.env.NUIT_INTAKE_CACHE || join(tmpdir(), 'nuit-intake-cache');
  try {
    updateJob(jobId, { status: 'processing', progress: 5 });
    await new Promise<void>((resolve, reject) => {
      const proc = spawn(transcriberBin(), [source, '--out', outDir, '--cache', cacheDir, '--progress', 'json']);
      let buffer = '';
      let stderr = '';
      let failure: string | undefined;
      proc.stdout.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          const parsed = parseProgressLine(line);
          if (!parsed) continue;
          if (parsed.stage === 'error') failure = parsed.error ?? 'guitar intake failed';
          else updateJob(jobId, { status: 'processing', progress: jobProgress(parsed.progress) });
        }
      });
      proc.stderr.on('data', (chunk: Buffer) => {
        stderr = (stderr + chunk.toString()).slice(-4000);
      });
      proc.on('error', reject);
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(failure ?? `nuit-transcribe exited with code ${code}: ${stderr.slice(-500)}`));
      });
    });

    updateJob(jobId, { status: 'uploading', progress: 92 });
    const keys: string[] = [];
    for (const { file, contentType } of GUITAR_OUTPUTS) {
      const path = join(outDir, file);
      const exists = await stat(path).then(
        () => true,
        () => false,
      );
      if (!exists) continue;
      const key = `${prefix}/${file}`;
      await uploadFile(key, path, contentType);
      keys.push(key);
    }
    if (!keys.includes(`${prefix}/performance.json`)) {
      throw new Error('guitar intake produced no performance document');
    }
    return keys;
  } finally {
    await rm(outDir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Read a stored performance document; null when the track has none yet. */
export async function readPerformance(
  prefix: string,
  download: (key: string, dest: string) => Promise<void>,
): Promise<unknown | null> {
  const dir = await mkdtemp(join(tmpdir(), 'nuit-guitar-read-'));
  const dest = join(dir, 'performance.json');
  try {
    await download(`${prefix}/performance.json`, dest);
    return JSON.parse(await readFile(dest, 'utf-8')) as unknown;
  } catch {
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
