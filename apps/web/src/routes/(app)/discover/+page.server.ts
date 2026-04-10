import { schema } from '@nuit-one/db';
import { error } from '@sveltejs/kit';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db.js';
import type { PageServerLoad } from './$types';

const catalogFields = {
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
};

function mapCatalog(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    sourceType: row.sourceType as string,
    sourceUrl: row.sourceUrl as string,
    title: row.title as string,
    artist: (row.artist as string | null) ?? null,
    album: (row.album as string | null) ?? null,
    thumbnailUrl: (row.thumbnailUrl as string | null) ?? null,
    durationSeconds: (row.durationSeconds as number | null) ?? null,
    genre: (row.genre as string | null) ?? null,
    chartName: (row.chartName as string) ?? '',
    chartRank: (row.chartRank as number | null) ?? null,
    popularity: (row.popularity as number | null) ?? null,
  };
}

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.userId) throw error(401, 'Unauthorized');
  const workspaceId = locals.workspaceId ?? '';

  // Get the latest chart date
  const [latestRow] = await db
    .select({ maxDate: sql<string>`MAX(${schema.catalogTracks.chartDate})` })
    .from(schema.catalogTracks);
  const latestDate = latestRow?.maxDate;

  if (!latestDate) {
    return {
      featured: [],
      trending: [],
      newThisWeek: [],
      genres: [] as string[],
      popularInWorkspace: [],
    };
  }

  // Featured: top 3 from Global Top 50
  const featured = await db
    .select(catalogFields)
    .from(schema.catalogTracks)
    .where(
      and(
        eq(schema.catalogTracks.chartDate, latestDate),
        eq(schema.catalogTracks.chartName, 'Spotify Global Top 50'),
      ),
    )
    .orderBy(schema.catalogTracks.chartRank)
    .limit(3);

  // Trending: top 20 across all charts
  const trending = await db
    .select(catalogFields)
    .from(schema.catalogTracks)
    .where(eq(schema.catalogTracks.chartDate, latestDate))
    .orderBy(desc(schema.catalogTracks.popularity))
    .limit(20);

  // New this week: recent entries ordered by creation date
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const newThisWeek = await db
    .select(catalogFields)
    .from(schema.catalogTracks)
    .where(sql`${schema.catalogTracks.chartDate} >= ${weekAgo}`)
    .orderBy(desc(schema.catalogTracks.createdAt))
    .limit(20);

  // Genre list (distinct, non-null)
  const genreRows = await db
    .select({ genre: schema.catalogTracks.genre })
    .from(schema.catalogTracks)
    .where(
      and(
        eq(schema.catalogTracks.chartDate, latestDate),
        sql`${schema.catalogTracks.genre} IS NOT NULL`,
      ),
    )
    .groupBy(schema.catalogTracks.genre);
  const genres = genreRows.map((r) => r.genre).filter(Boolean) as string[];

  // Popular in workspace: most-accessed ready content sources
  const popularInWorkspace = await db
    .select({
      id: schema.contentSources.id,
      title: schema.contentSources.title,
      artist: schema.contentSources.artist,
      thumbnailUrl: schema.contentSources.thumbnailUrl,
      durationSeconds: schema.contentSources.durationSeconds,
      sourceType: schema.contentSources.sourceType,
      sourceUrl: schema.contentSources.originalUrl,
    })
    .from(schema.contentSources)
    .where(
      and(
        eq(schema.contentSources.workspaceId, workspaceId),
        eq(schema.contentSources.status, 'ready'),
      ),
    )
    .orderBy(desc(schema.contentSources.lastAccessedAt))
    .limit(10);

  return {
    featured: featured.map(mapCatalog),
    trending: trending.map(mapCatalog),
    newThisWeek: newThisWeek.map(mapCatalog),
    genres,
    popularInWorkspace: popularInWorkspace.map((r) => ({
      id: r.id,
      sourceType: r.sourceType,
      sourceUrl: r.sourceUrl,
      title: r.title,
      artist: r.artist ?? null,
      album: null,
      thumbnailUrl: r.thumbnailUrl ?? null,
      durationSeconds: r.durationSeconds ?? null,
      genre: null,
      chartName: '',
      chartRank: null,
      popularity: null,
    })),
  };
};
