import type { Database } from '@nuit-one/db';
import { schema } from '@nuit-one/db';
import { and, eq } from 'drizzle-orm';

interface SpotifyTrack {
  sourceUrl: string;
  sourceId: string;
  title: string;
  artist: string | null;
  album: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  popularity: number | null;
}

const SPOTIFY_PLAYLISTS = [
  { id: '37i9dQZEVXbMDoHDwVN2tF', name: 'Spotify Global Top 50' },
  { id: '37i9dQZEVXbLiRSasKsNU9', name: 'Spotify Viral 50' },
  { id: '37i9dQZEVXbLRQDuF5jeBp', name: 'Spotify US Top 50' },
];

async function getAccessToken(clientId: string, clientSecret: string): Promise<string> {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) throw new Error(`Spotify auth failed: ${response.status}`);
  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

async function fetchPlaylistTracks(
  accessToken: string,
  playlistId: string,
): Promise<SpotifyTrack[]> {
  const response = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50&fields=items(track(id,name,artists,album,duration_ms,popularity))`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!response.ok) throw new Error(`Spotify playlist fetch failed: ${response.status}`);

  const data = (await response.json()) as {
    items: Array<{
      track: {
        id: string;
        name: string;
        artists: Array<{ name: string }>;
        album: { name: string; images: Array<{ url: string }> };
        duration_ms: number;
        popularity: number;
      } | null;
    }>;
  };

  return data.items
    .filter((item) => item.track !== null)
    .map((item) => {
      const t = item.track!;
      const artistName = t.artists[0]?.name ?? null;
      return {
        sourceUrl: `ytsearch1:${t.name} ${artistName ?? ''}`.trim(),
        sourceId: t.id,
        title: t.name,
        artist: artistName,
        album: t.album.name,
        thumbnailUrl: t.album.images[0]?.url ?? null,
        durationSeconds: Math.round(t.duration_ms / 1000),
        popularity: t.popularity,
      };
    });
}

export async function scrapeSpotifyCharts(
  db: Database,
  clientId: string,
  clientSecret: string,
): Promise<number> {
  const accessToken = await getAccessToken(clientId, clientSecret);
  const today = new Date().toISOString().slice(0, 10);
  let totalInserted = 0;

  for (const playlist of SPOTIFY_PLAYLISTS) {
    const tracks = await fetchPlaylistTracks(accessToken, playlist.id);

    // Delete today's entries for this chart (idempotent re-runs)
    await db.delete(schema.catalogTracks).where(
      and(
        eq(schema.catalogTracks.chartName, playlist.name),
        eq(schema.catalogTracks.chartDate, today),
      ),
    );

    // Insert fresh entries
    if (tracks.length > 0) {
      await db.insert(schema.catalogTracks).values(
        tracks.map((track, rank) => ({
          sourceType: 'spotify' as const,
          sourceUrl: track.sourceUrl,
          sourceId: track.sourceId,
          title: track.title,
          artist: track.artist,
          album: track.album,
          thumbnailUrl: track.thumbnailUrl,
          durationSeconds: track.durationSeconds,
          genre: null,
          chartName: playlist.name,
          chartRank: rank + 1,
          chartDate: today,
          popularity: track.popularity,
        })),
      );
      totalInserted += tracks.length;
    }
  }

  return totalInserted;
}
