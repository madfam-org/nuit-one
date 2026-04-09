import { spawn } from 'node:child_process';
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { updateJob } from './job-manager.js';
import { downloadFile, uploadFile } from './storage.js';

export type DemucsStemType = 'vocals' | 'drums' | 'bass' | 'other';

export interface StemResult {
  stemType: DemucsStemType;
  r2Key: string;
  fileSizeBytes: number;
}

export async function runDemucs(jobId: string, trackId: string, r2Key: string): Promise<StemResult[]> {
  const workDir = await mkdtemp(join(tmpdir(), 'nuit-demucs-'));
  const inputPath = join(workDir, 'input.wav');
  const outputDir = join(workDir, 'output');

  try {
    // Download original audio from R2
    updateJob(jobId, { status: 'downloading', progress: 10 });
    await downloadFile(r2Key, inputPath);

    // Run Demucs: 4-stem separation (vocals, drums, bass, other)
    updateJob(jobId, { status: 'processing', progress: 20 });
    await new Promise<void>((resolve, reject) => {
      const proc = spawn('demucs', ['-n', 'htdemucs', '-o', outputDir, inputPath]);

      let stderr = '';
      proc.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
        // Parse Demucs progress from stderr (rough estimate)
        if (stderr.includes('%')) {
          const match = stderr.match(/(\d+)%/);
          if (match) {
            const pct = parseInt(match[1]!, 10);
            updateJob(jobId, { progress: 20 + Math.round(pct * 0.6) });
          }
        }
      });

      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Demucs exited with code ${code}: ${stderr}`));
      });

      proc.on('error', reject);
    });

    // Find output stems
    // Demucs 4-stem outputs to: outputDir/htdemucs/<track_name>/{vocals,drums,bass,other}.wav
    const modelDir = join(outputDir, 'htdemucs');
    const trackDirs = await readdir(modelDir);
    const stemDir = join(modelDir, trackDirs[0]!);
    const stemFiles = await readdir(stemDir);

    const VALID_STEMS: Set<string> = new Set(['vocals', 'drums', 'bass', 'other']);

    // Upload stems to R2
    updateJob(jobId, { status: 'uploading', progress: 85 });
    const results: StemResult[] = [];

    for (const file of stemFiles) {
      if (!file.endsWith('.wav')) continue;
      const stemName = file.replace('.wav', '');
      if (!VALID_STEMS.has(stemName)) continue;
      const stemType = stemName as DemucsStemType;
      const filePath = join(stemDir, file);
      const r2StemKey = `tracks/${trackId}/stems/${stemType}.wav`;

      await uploadFile(r2StemKey, filePath, 'audio/wav');
      const fileInfo = await stat(filePath);

      results.push({
        stemType,
        r2Key: r2StemKey,
        fileSizeBytes: fileInfo.size,
      });
    }

    updateJob(jobId, { status: 'complete', progress: 100 });
    return results;
  } finally {
    // Clean up temp directory
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
