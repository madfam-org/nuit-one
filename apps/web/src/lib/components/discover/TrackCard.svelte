<script lang="ts">
  import type { CatalogTrack } from '@nuit-one/shared';

  interface Props {
    track: CatalogTrack;
    onImport: (track: CatalogTrack) => void;
    importing?: boolean;
  }

  const { track, onImport, importing = false }: Props = $props();

  function formatDuration(seconds: number | null): string {
    if (seconds == null) return '';
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function sourceBadge(sourceType: string): { label: string; className: string } {
    if (sourceType.toLowerCase().includes('youtube') || sourceType === 'youtube') {
      return { label: 'YT', className: 'source-yt' };
    }
    return { label: 'SP', className: 'source-sp' };
  }

  const badge = $derived(sourceBadge(track.sourceType));
</script>

<button
  class="track-card"
  type="button"
  aria-label="Import {track.title}{track.artist ? ` by ${track.artist}` : ''}"
  onclick={() => { if (!importing) onImport(track); }}
>
  <div class="thumbnail-wrap">
    {#if track.thumbnailUrl}
      <img
        src={track.thumbnailUrl}
        alt=""
        class="thumbnail"
        loading="lazy"
        decoding="async"
      />
    {:else}
      <div class="thumbnail-fallback" aria-hidden="true"></div>
    {/if}

    <span class="badge-source {badge.className}">{badge.label}</span>

    {#if track.chartRank != null && track.chartRank <= 10}
      <span class="badge-rank">#{track.chartRank}</span>
    {/if}

    {#if track.durationSeconds != null}
      <span class="badge-duration">{formatDuration(track.durationSeconds)}</span>
    {/if}

    <div class="hover-overlay" aria-hidden="true">
      {#if importing}
        <div class="spinner" aria-label="Importing"></div>
      {:else}
        <span class="import-label">Import</span>
      {/if}
    </div>
  </div>

  <span class="track-title">{track.title}</span>
  <span class="track-artist">{track.artist ?? 'Unknown artist'}</span>
</button>

<style>
  .track-card {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    width: 180px;
    min-width: 180px;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    text-align: left;
    color: inherit;
    font-family: inherit;
    outline: none;
    scroll-snap-align: start;
  }

  .thumbnail-wrap {
    position: relative;
    width: 100%;
    aspect-ratio: 1 / 1;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.06);
    transition: border-color 250ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  .track-card:hover .thumbnail-wrap,
  .track-card:focus-visible .thumbnail-wrap {
    border-color: rgba(0, 245, 255, 0.3);
  }

  .track-card:focus-visible .thumbnail-wrap {
    box-shadow: 0 0 0 2px rgba(0, 245, 255, 0.4);
  }

  .thumbnail {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .thumbnail-fallback {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #8b5cf6 0%, #00f5ff 50%, #ff00e5 100%);
    opacity: 0.5;
  }

  /* Source badge (top-left) */
  .badge-source {
    position: absolute;
    top: 6px;
    left: 6px;
    padding: 1px 6px;
    border-radius: 6px;
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    line-height: 1.5;
  }

  .source-yt {
    background: rgba(255, 0, 0, 0.7);
    color: #fff;
  }

  .source-sp {
    background: rgba(30, 215, 96, 0.7);
    color: #fff;
  }

  /* Rank badge (top-right) */
  .badge-rank {
    position: absolute;
    top: 6px;
    right: 6px;
    padding: 1px 6px;
    border-radius: 6px;
    font-size: 0.65rem;
    font-weight: 700;
    font-family: 'JetBrains Mono', monospace;
    background: rgba(0, 245, 255, 0.15);
    color: #00f5ff;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    line-height: 1.5;
  }

  /* Duration badge (bottom-right) */
  .badge-duration {
    position: absolute;
    bottom: 6px;
    right: 6px;
    padding: 1px 6px;
    border-radius: 6px;
    font-size: 0.6rem;
    font-family: 'JetBrains Mono', monospace;
    background: rgba(0, 0, 0, 0.6);
    color: #e0e0e8;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    line-height: 1.5;
  }

  /* Hover overlay */
  .hover-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.55);
    opacity: 0;
    transition: opacity 200ms ease;
  }

  .track-card:hover .hover-overlay,
  .track-card:focus-visible .hover-overlay {
    opacity: 1;
  }

  .import-label {
    padding: 0.375rem 1rem;
    border-radius: 8px;
    background: #00f5ff;
    color: #0a0a0f;
    font-size: 0.8rem;
    font-weight: 600;
    transition: box-shadow 200ms ease;
  }

  .track-card:hover .import-label {
    box-shadow: 0 0 16px rgba(0, 245, 255, 0.35);
  }

  /* Spinner */
  .spinner {
    width: 24px;
    height: 24px;
    border: 2px solid rgba(0, 245, 255, 0.3);
    border-top-color: #00f5ff;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Title & artist */
  .track-title {
    font-size: 0.8rem;
    font-weight: 500;
    color: #f0f0f5;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: block;
  }

  .track-artist {
    font-size: 0.7rem;
    color: #606070;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: block;
  }
</style>
