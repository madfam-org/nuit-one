import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { downloadFromR2 } from './r2.js';
import { updateJob } from './job-manager.js';
import type { NoteEvent } from '@nuit-one/shared';

export async function runTranscription(
  jobId: string,
  r2Key: string,
): Promise<NoteEvent[]> {
  const workDir = await mkdtemp(join(tmpdir(), 'nuit-pitch-'));
  const inputPath = join(workDir, 'input.wav');
  const outputDir = join(workDir, 'output');

  try {
    // Download stem from R2
    updateJob(jobId, { status: 'downloading', progress: 10 });
    await downloadFromR2(r2Key, inputPath);

    // Run Basic Pitch
    updateJob(jobId, { status: 'processing', progress: 30 });
    await new Promise<void>((resolve, reject) => {
      const proc = spawn('basic-pitch', [outputDir, inputPath]);

      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Basic Pitch exited with code ${code}`));
      });

      proc.on('error', reject);
    });

    // Parse MIDI CSV output
    // Basic Pitch outputs: <filename>_basic_pitch.csv with columns:
    // start_time_s, duration_s, pitch_midi, velocity, [confidence]
    updateJob(jobId, { status: 'uploading', progress: 80 });

    const csvPath = join(outputDir, 'input_basic_pitch.csv');
    const csvContent = await readFile(csvPath, 'utf-8');
    const lines = csvContent.trim().split('\n');

    const notes: NoteEvent[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i]!.split(',');
      if (cols.length < 4) continue;

      notes.push({
        startTime: parseFloat(cols[0]!),
        duration: parseFloat(cols[1]!),
        pitch: Math.round(parseFloat(cols[2]!)),
        velocity: Math.round(parseFloat(cols[3]!)),
      });
    }

    updateJob(jobId, { status: 'complete', progress: 100 });
    return notes;
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
