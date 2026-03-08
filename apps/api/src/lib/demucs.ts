import { spawn } from 'node:child_process';
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { downloadFromR2, uploadToR2 } from './r2.js';
import { updateJob } from './job-manager.js';

export interface StemResult {
  stemType: 'bass' | 'no_bass';
  r2Key: string;
  fileSizeBytes: number;
}

export async function runDemucs(
  jobId: string,
  trackId: string,
  r2Key: string,
): Promise<StemResult[]> {
  const workDir = await mkdtemp(join(tmpdir(), 'nuit-demucs-'));
  const inputPath = join(workDir, 'input.wav');
  const outputDir = join(workDir, 'output');

  try {
    // Download original audio from R2
    updateJob(jobId, { status: 'downloading', progress: 10 });
    await downloadFromR2(r2Key, inputPath);

    // Run Demucs: --two-stems bass produces bass + no_bass
    updateJob(jobId, { status: 'processing', progress: 20 });
    await new Promise<void>((resolve, reject) => {
      const proc = spawn('demucs', [
        '--two-stems', 'bass',
        '-n', 'htdemucs',
        '-o', outputDir,
        inputPath,
      ]);

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
    // Demucs outputs to: outputDir/htdemucs/<track_name>/bass.wav and no_bass.wav
    const modelDir = join(outputDir, 'htdemucs');
    const trackDirs = await readdir(modelDir);
    const stemDir = join(modelDir, trackDirs[0]!);
    const stemFiles = await readdir(stemDir);

    // Upload stems to R2
    updateJob(jobId, { status: 'uploading', progress: 85 });
    const results: StemResult[] = [];

    for (const file of stemFiles) {
      if (!file.endsWith('.wav')) continue;
      const stemType = file.replace('.wav', '') as 'bass' | 'no_bass';
      const filePath = join(stemDir, file);
      const r2StemKey = `tracks/${trackId}/stems/${stemType}.wav`;

      await uploadToR2(r2StemKey, filePath, 'audio/wav');
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
