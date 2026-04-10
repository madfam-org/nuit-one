import type { Database } from '@nuit-one/db';
import { scrapeSpotifyCharts } from './spotify.js';
import { scrapeYouTubeCharts } from './youtube-charts.js';

export interface ChartRefreshResult {
  spotify: number;
  youtube: number;
  errors: string[];
}

export async function refreshAllCharts(
  db: Database,
  spotifyClientId?: string,
  spotifyClientSecret?: string,
): Promise<ChartRefreshResult> {
  const errors: string[] = [];
  let spotify = 0;
  let youtube = 0;

  // Spotify (requires credentials)
  if (spotifyClientId && spotifyClientSecret) {
    try {
      spotify = await scrapeSpotifyCharts(db, spotifyClientId, spotifyClientSecret);
    } catch (err) {
      errors.push(`Spotify: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else {
    errors.push('Spotify: Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET');
  }

  // YouTube (no credentials needed)
  try {
    youtube = await scrapeYouTubeCharts(db);
  } catch (err) {
    errors.push(`YouTube: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { spotify, youtube, errors };
}
