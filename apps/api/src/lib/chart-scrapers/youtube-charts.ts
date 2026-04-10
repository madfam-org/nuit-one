import { spawn } from 'node:child_process';
import type { Database } from '@nuit-one/db';
import { schema } from '@nuit-one/db';
import { and, eq } from 'drizzle-orm';

interface YtPlaylistEntry {
  id: string;
  title: string;
  uploader: string | null;
  duration: number | null;
  thumbnails: Array<{ url: string }> | null;
}

const YOUTUBE_PLAYLISTS = [
  {
    url: 'https://www.youtube.com/playlist?list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI',
    name: 'YouTube Top 100 Music Videos',
  },
];

async function fetchPlaylistEntries(playlistUrl: string): Promise<YtPlaylistEntry[]> {
  return new Promise((resolve, reject) => {
    const proc = spawn('yt-dlp', [
      '--flat-playlist',
      '--dump-json',
      '--no-warnings',
      playlistUrl,
    ]);

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
        reject(new Error(`yt-dlp playlist fetch failed: ${stderr.slice(0, 500)}`));
        return;
      }

      const entries: YtPlaylistEntry[] = [];
      for (const line of stdout.trim().split('\n')) {
        if (!line) continue;
        try {
          const json = JSON.parse(line) as Record<string, unknown>;
          entries.push({
            id: (json.id as string) ?? '',
            title: (json.title as string) ?? 'Untitled',
            uploader: (json.uploader as string) ?? (json.channel as string) ?? null,
            duration: (json.duration as number) ?? null,
            thumbnails: (json.thumbnails as Array<{ url: string }>) ?? null,
          });
        } catch {
          // Skip malformed lines
        }
      }
      resolve(entries);
    });

    proc.on('error', reject);
  });
}

export async function scrapeYouTubeCharts(db: Database): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  let totalInserted = 0;

  for (const playlist of YOUTUBE_PLAYLISTS) {
    const entries = await fetchPlaylistEntries(playlist.url);

    // Delete today's entries for this chart (idempotent re-runs)
    await db.delete(schema.catalogTracks).where(
      and(
        eq(schema.catalogTracks.chartName, playlist.name),
        eq(schema.catalogTracks.chartDate, today),
      ),
    );

    // Insert fresh entries
    if (entries.length > 0) {
      await db.insert(schema.catalogTracks).values(
        entries.map((entry, rank) => ({
          sourceType: 'youtube' as const,
          sourceUrl: `https://www.youtube.com/watch?v=${entry.id}`,
          sourceId: entry.id,
          title: entry.title,
          artist: entry.uploader,
          album: null,
          thumbnailUrl: entry.thumbnails?.[entry.thumbnails.length - 1]?.url ?? null,
          durationSeconds: entry.duration,
          genre: null,
          chartName: playlist.name,
          chartRank: rank + 1,
          chartDate: today,
          popularity: null,
        })),
      );
      totalInserted += entries.length;
    }
  }

  return totalInserted;
}
