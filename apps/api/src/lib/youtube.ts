import { spawn } from 'node:child_process';
import { mkdtemp, readdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface YouTubeResult {
  title: string;
  filePath: string;
  fileSizeBytes: number;
}

const YOUTUBE_URL_PATTERN = /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|music\.youtube\.com\/watch\?v=)/;

export function isValidYouTubeUrl(url: string): boolean {
  return YOUTUBE_URL_PATTERN.test(url);
}

export async function downloadYouTubeAudio(url: string): Promise<YouTubeResult> {
  if (!isValidYouTubeUrl(url)) {
    throw new Error('Invalid YouTube URL');
  }

  const workDir = await mkdtemp(join(tmpdir(), 'nuit-yt-'));

  // Get video title first
  const title = await new Promise<string>((resolve, reject) => {
    const proc = spawn('yt-dlp', ['--get-title', '--no-warnings', url]);
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    proc.on('close', (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(`yt-dlp title fetch failed: ${stderr}`));
    });
    proc.on('error', reject);
  });

  // Download audio as WAV
  await new Promise<void>((resolve, reject) => {
    const proc = spawn('yt-dlp', [
      '-x',
      '--audio-format', 'wav',
      '-o', join(workDir, 'audio.%(ext)s'),
      '--no-warnings',
      url,
    ]);

    let stderr = '';
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`yt-dlp download failed: ${stderr}`));
    });
    proc.on('error', reject);
  });

  // Find the output file
  const files = await readdir(workDir);
  const wavFile = files.find((f) => f.endsWith('.wav'));
  if (!wavFile) throw new Error('yt-dlp did not produce a WAV file');

  const filePath = join(workDir, wavFile);
  const fileInfo = await stat(filePath);

  return {
    title,
    filePath,
    fileSizeBytes: fileInfo.size,
  };
}
