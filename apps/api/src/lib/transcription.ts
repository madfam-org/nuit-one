import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { NoteEvent } from '@nuit-one/shared';
import { updateJob } from './job-manager.js';
import { downloadFile } from './storage.js';

/** Parse Basic Pitch 0.4+ note-events CSV (start_time_s,end_time_s,pitch_midi,velocity,...) */
export function parseNoteEventsCsv(csvContent: string): NoteEvent[] {
  const lines = csvContent.trim().split('\n');
  const notes: NoteEvent[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i]!.split(',');
    if (cols.length < 4) continue;

    const startTime = parseFloat(cols[0]!);
    const endTime = parseFloat(cols[1]!);

    notes.push({
      startTime,
      duration: endTime - startTime,
      pitch: Math.round(parseFloat(cols[2]!)),
      velocity: Math.round(parseFloat(cols[3]!)),
    });
  }
  return notes;
}

export async function runTranscription(jobId: string, r2Key: string): Promise<NoteEvent[]> {
  const workDir = await mkdtemp(join(tmpdir(), 'nuit-pitch-'));
  const inputPath = join(workDir, 'input.wav');
  const outputDir = join(workDir, 'output');

  try {
    // Download stem from storage
    updateJob(jobId, { status: 'downloading', progress: 10 });
    await downloadFile(r2Key, inputPath);

    // Create output directory (basic-pitch requires it to exist)
    await mkdir(outputDir, { recursive: true });

    // Run Basic Pitch with --save-note-events for CSV output
    updateJob(jobId, { status: 'processing', progress: 30 });
    await new Promise<void>((resolve, reject) => {
      const proc = spawn('basic-pitch', ['--save-note-events', outputDir, inputPath]);

      let stderr = '';
      proc.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Basic Pitch exited with code ${code}: ${stderr}`));
      });

      proc.on('error', reject);
    });

    // Parse CSV output
    // Basic Pitch 0.4+ outputs: start_time_s,end_time_s,pitch_midi,velocity,pitch_bend...
    updateJob(jobId, { status: 'uploading', progress: 80 });

    const csvPath = join(outputDir, 'input_basic_pitch.csv');
    const csvContent = await readFile(csvPath, 'utf-8');
    const notes = parseNoteEventsCsv(csvContent);

    updateJob(jobId, { status: 'complete', progress: 100 });
    return notes;
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
