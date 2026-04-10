import { spawn } from 'node:child_process';
import { mkdtemp, readdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface MediaMetadata {
  title: string;
  artist: string | null;
  sourceType: string;
  sourceId: string;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
}

export interface MediaResult extends MediaMetadata {
  sourceUrl: string;
  filePath: string;
  fileSizeBytes: number;
}

/**
 * Parse the JSON output from `yt-dlp --dump-json` into MediaMetadata.
 * Exported for unit testing without needing to spawn a real process.
 */
export function parseYtDlpJson(json: Record<string, unknown>): MediaMetadata {
  return {
    title: (json.title as string) ?? (json.fulltitle as string) ?? 'Untitled',
    artist: (json.uploader as string) ?? (json.artist as string) ?? (json.channel as string) ?? null,
    sourceType: (
      (json.extractor_key as string) ?? (json.extractor as string) ?? 'unknown'
    ).toLowerCase(),
    sourceId: (json.id as string) ?? '',
    thumbnailUrl: (json.thumbnail as string) ?? null,
    durationSeconds: (json.duration as number) ?? null,
  };
}

/** Extract metadata from a URL without downloading */
export async function extractMetadata(url: string): Promise<MediaMetadata> {
  return new Promise((resolve, reject) => {
    const proc = spawn('yt-dlp', ['--dump-json', '--no-warnings', '--no-download', url]);
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`yt-dlp metadata extraction failed: ${stderr.slice(0, 500)}`));
        return;
      }
      try {
        const json = JSON.parse(stdout) as Record<string, unknown>;
        resolve(parseYtDlpJson(json));
      } catch (err) {
        reject(new Error(`Failed to parse yt-dlp JSON: ${err}`));
      }
    });
    proc.on('error', reject);
  });
}

/** Download audio as WAV and return metadata + file info */
export async function extractMedia(url: string): Promise<MediaResult> {
  // First get metadata
  const metadata = await extractMetadata(url);

  // Then download
  const workDir = await mkdtemp(join(tmpdir(), 'nuit-media-'));

  await new Promise<void>((resolve, reject) => {
    const proc = spawn('yt-dlp', [
      '-f',
      'bestaudio',
      '-x',
      '--audio-format',
      'wav',
      '--audio-quality',
      '0',
      '-o',
      join(workDir, 'audio.%(ext)s'),
      '--no-warnings',
      url,
    ]);

    let stderr = '';
    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`yt-dlp download failed: ${stderr.slice(0, 500)}`));
    });
    proc.on('error', reject);
  });

  const files = await readdir(workDir);
  const wavFile = files.find((f) => f.endsWith('.wav'));
  if (!wavFile) throw new Error('yt-dlp did not produce a WAV file');

  const filePath = join(workDir, wavFile);
  const fileInfo = await stat(filePath);

  return {
    ...metadata,
    sourceUrl: url,
    filePath,
    fileSizeBytes: fileInfo.size,
  };
}
