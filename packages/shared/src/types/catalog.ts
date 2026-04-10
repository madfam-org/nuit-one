export interface CatalogTrack {
  readonly id: string;
  readonly sourceType: string;
  readonly sourceUrl: string;
  readonly title: string;
  readonly artist: string | null;
  readonly album: string | null;
  readonly thumbnailUrl: string | null;
  readonly durationSeconds: number | null;
  readonly genre: string | null;
  readonly chartName: string;
  readonly chartRank: number | null;
  readonly popularity: number | null;
}

export interface CatalogSection {
  readonly title: string;
  readonly tracks: CatalogTrack[];
}
