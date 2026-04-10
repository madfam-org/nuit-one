<script lang="ts">
  import type { CatalogTrack } from '@nuit-one/shared';
  import TrackCard from './TrackCard.svelte';

  interface Props {
    title: string;
    tracks: CatalogTrack[];
    onImport: (track: CatalogTrack) => void;
  }

  const { title, tracks, onImport }: Props = $props();

  let importingIds = $state<Set<string>>(new Set());

  function handleImport(track: CatalogTrack) {
    importingIds.add(track.id);
    importingIds = new Set(importingIds);
    onImport(track);
  }
</script>

{#if tracks.length > 0}
  <section class="track-row" aria-label={title}>
    <h2 class="row-title">{title}</h2>
    <div class="scroll-container">
      <div class="cards">
        {#each tracks as track (track.id)}
          <TrackCard
            {track}
            onImport={handleImport}
            importing={importingIds.has(track.id)}
          />
        {/each}
      </div>
      <div class="fade-edge" aria-hidden="true"></div>
    </div>
  </section>
{/if}

<style>
  .track-row {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .row-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #f0f0f5;
    margin: 0;
  }

  .scroll-container {
    position: relative;
  }

  .cards {
    display: flex;
    gap: 0.75rem;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
    -ms-overflow-style: none;
    padding-bottom: 4px;
  }

  .cards::-webkit-scrollbar {
    display: none;
  }

  .fade-edge {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 4px;
    width: 20px;
    background: linear-gradient(to right, transparent, #0a0a0f);
    pointer-events: none;
  }
</style>
