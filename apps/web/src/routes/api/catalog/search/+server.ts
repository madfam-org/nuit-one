import { schema } from '@nuit-one/db';
import { json } from '@sveltejs/kit';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from '$lib/server/db.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  const query = url.searchParams.get('q') ?? '';
  const genre = url.searchParams.get('genre');
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20', 10), 50);

  if (!query && !genre) return json([]);

  const conditions = [];

  if (query) {
    conditions.push(
      or(
        ilike(schema.catalogTracks.title, `%${query}%`),
        ilike(schema.catalogTracks.artist, `%${query}%`),
      ),
    );
  }

  if (genre) {
    conditions.push(eq(schema.catalogTracks.genre, genre));
  }

  // Get the latest chart date to avoid showing stale entries
  const [latest] = await db
    .select({ maxDate: sql<string>`MAX(${schema.catalogTracks.chartDate})` })
    .from(schema.catalogTracks);

  if (latest?.maxDate) {
    conditions.push(eq(schema.catalogTracks.chartDate, latest.maxDate));
  }

  const results = await db
    .select({
      id: schema.catalogTracks.id,
      sourceType: schema.catalogTracks.sourceType,
      sourceUrl: schema.catalogTracks.sourceUrl,
      title: schema.catalogTracks.title,
      artist: schema.catalogTracks.artist,
      album: schema.catalogTracks.album,
      thumbnailUrl: schema.catalogTracks.thumbnailUrl,
      durationSeconds: schema.catalogTracks.durationSeconds,
      genre: schema.catalogTracks.genre,
      chartName: schema.catalogTracks.chartName,
      chartRank: schema.catalogTracks.chartRank,
      popularity: schema.catalogTracks.popularity,
    })
    .from(schema.catalogTracks)
    .where(and(...conditions))
    .orderBy(desc(schema.catalogTracks.popularity))
    .limit(limit);

  return json(results);
};
