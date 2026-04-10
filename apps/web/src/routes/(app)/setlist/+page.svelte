<script lang="ts">
  import { onMount } from 'svelte';
  import { Button, GlassCard } from '@nuit-one/ui';
  import { goto } from '$app/navigation';
  import { getSetlistStore } from '$lib/stores/setlist.svelte.js';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const setlist = getSetlistStore();

  // Track which available track is already in the setlist
  const setlistTrackIds = $derived(new Set(setlist.tracks.map((t) => t.trackId)));
  const canStart = $derived(setlist.tracks.length > 0);

  // Offline prefetch state
  let prefetching = $state(false);
  let prefetchProgress = $state(0);
  let prefetchTotal = $state(0);
  let prefetchDone = $state(false);
  let hasServiceWorker = $state(false);

  onMount(() => {
    hasServiceWorker = !!navigator.serviceWorker?.controller;
  });

  async function downloadForOffline() {
    if (prefetching || setlist.tracks.length === 0) return;
    prefetching = true;
    prefetchDone = false;
    prefetchProgress = 0;
    prefetchTotal = 0;

    async function stemUrlsFetcher(trackId: string): Promise<Record<string, string>> {
      try {
        const res = await fetch(`/api/tracks/${trackId}/stems`);
        if (!res.ok) return {};
        const data = await res.json();
        return data.urls ?? {};
      } catch {
        return {};
      }
    }

    await setlist.prefetchStems(stemUrlsFetcher, (completed, total) => {
      prefetchProgress = completed;
      prefetchTotal = total;
    });

    prefetching = false;
    prefetchDone = true;
  }

  function addTrack(id: string, title: string) {
    if (setlistTrackIds.has(id)) return;
    setlist.addTrack({ trackId: id, title });
  }

  function removeTrack(index: number) {
    setlist.removeTrack(index);
  }

  function startSetlist() {
    if (!canStart) return;
    setlist.start();
    const first = setlist.currentTrack;
    if (first) {
      goto(`/perform/${first.trackId}?setlist=true`);
    }
  }

  // Drag-and-drop state
  let dragIndex = $state<number | null>(null);
  let dropTargetIndex = $state<number | null>(null);

  function onDragStart(index: number, e: DragEvent) {
    dragIndex = index;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));
    }
  }

  function onDragOver(index: number, e: DragEvent) {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
    dropTargetIndex = index;
  }

  function onDragLeave() {
    dropTargetIndex = null;
  }

  function onDrop(toIndex: number, e: DragEvent) {
    e.preventDefault();
    if (dragIndex !== null && dragIndex !== toIndex) {
      setlist.moveTrack(dragIndex, toIndex);
    }
    dragIndex = null;
    dropTargetIndex = null;
  }

  function onDragEnd() {
    dragIndex = null;
    dropTargetIndex = null;
  }
</script>

<div class="setlist-page">
  <header class="setlist-header">
    <h1 class="page-title">Build Your Setlist</h1>
    <p class="page-subtitle">Add tracks and arrange the order for your performance session.</p>
  </header>

  <div class="setlist-layout">
    <!-- Available Tracks -->
    <div class="panel">
      <GlassCard padding="md">
        <h2 class="panel-title">Available Tracks</h2>
        {#if data.availableTracks.length === 0}
          <p class="empty-text">No playable tracks found. Import a song first.</p>
        {:else}
          <ul class="track-list" role="list">
            {#each data.availableTracks as track (track.id)}
              {@const inSetlist = setlistTrackIds.has(track.id)}
              <li class="track-item" class:in-setlist={inSetlist}>
                <span class="track-title">{track.title}</span>
                <button
                  class="add-btn"
                  disabled={inSetlist}
                  onclick={() => addTrack(track.id, track.title)}
                  aria-label="Add {track.title} to setlist"
                >
                  {#if inSetlist}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                      stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
                      <path d="M20 6L9 17l-5-5"/>
                    </svg>
                  {:else}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                      stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
                      <path d="M12 5v14M5 12h14"/>
                    </svg>
                  {/if}
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </GlassCard>
    </div>

    <!-- Your Setlist -->
    <div class="panel">
      <GlassCard padding="md">
        <div class="panel-header">
          <h2 class="panel-title">Your Setlist</h2>
          {#if setlist.tracks.length > 0}
            <span class="track-count">{setlist.tracks.length} track{setlist.tracks.length !== 1 ? 's' : ''}</span>
          {/if}
        </div>

        {#if setlist.tracks.length === 0}
          <div class="empty-setlist">
            <p class="empty-text">Add tracks from the list to build your setlist.</p>
          </div>
        {:else}
          <ol class="setlist-list" role="list">
            {#each setlist.tracks as track, i (track.trackId + '-' + i)}
              <li
                class="setlist-item"
                class:dragging={dragIndex === i}
                class:drop-target={dropTargetIndex === i && dragIndex !== i}
                draggable="true"
                ondragstart={(e) => onDragStart(i, e)}
                ondragover={(e) => onDragOver(i, e)}
                ondragleave={onDragLeave}
                ondrop={(e) => onDrop(i, e)}
                ondragend={onDragEnd}
                role="listitem"
              >
                <span class="setlist-position">{i + 1}</span>
                <span class="drag-handle" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                    <circle cx="9" cy="6" r="1.5"/>
                    <circle cx="15" cy="6" r="1.5"/>
                    <circle cx="9" cy="12" r="1.5"/>
                    <circle cx="15" cy="12" r="1.5"/>
                    <circle cx="9" cy="18" r="1.5"/>
                    <circle cx="15" cy="18" r="1.5"/>
                  </svg>
                </span>
                <span class="setlist-track-title">{track.title}</span>
                <button
                  class="remove-btn"
                  onclick={() => removeTrack(i)}
                  aria-label="Remove {track.title} from setlist"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                    stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </li>
            {/each}
          </ol>
        {/if}
      </GlassCard>
    </div>
  </div>

  <div class="setlist-actions">
    <Button variant="primary" size="lg" disabled={!canStart} onclick={startSetlist}>
      Start Setlist
    </Button>
    {#if hasServiceWorker && setlist.tracks.length > 0}
      <button
        class="offline-btn"
        class:done={prefetchDone}
        disabled={prefetching}
        onclick={downloadForOffline}
        aria-label={prefetchDone ? 'Downloaded for offline' : 'Download for offline'}
      >
        {#if prefetchDone}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
          Offline Ready
        {:else if prefetching}
          <div class="prefetch-progress-wrap">
            <span>Downloading... {prefetchProgress}/{prefetchTotal}</span>
            <div class="prefetch-bar-bg">
              <div
                class="prefetch-bar-fill"
                style:width="{prefetchTotal > 0 ? (prefetchProgress / prefetchTotal) * 100 : 0}%"
              ></div>
            </div>
          </div>
        {:else}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Download for Offline
        {/if}
      </button>
    {/if}
    {#if setlist.tracks.length > 0}
      <Button variant="ghost" onclick={() => setlist.clear()}>
        Clear All
      </Button>
    {/if}
  </div>
</div>

<style>
  .setlist-page {
    padding: 1.5rem;
    max-width: 1100px;
    margin: 0 auto;
  }

  .setlist-header {
    margin-bottom: 1.5rem;
  }

  .page-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #f0f0f5;
    margin-bottom: 0.25rem;
  }

  .page-subtitle {
    font-size: 0.875rem;
    color: #606070;
  }

  .setlist-layout {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  @media (min-width: 768px) {
    .setlist-layout {
      flex-direction: row;
    }

    .panel {
      flex: 1;
      min-width: 0;
    }
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }

  .panel-title {
    font-size: 1rem;
    font-weight: 600;
    color: #f0f0f5;
    margin-bottom: 0.75rem;
  }

  .panel-header .panel-title {
    margin-bottom: 0;
  }

  .track-count {
    font-size: 0.75rem;
    color: #00f5ff;
    font-weight: 600;
    background: rgba(0, 245, 255, 0.1);
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
  }

  .track-list,
  .setlist-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .track-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.625rem 0.75rem;
    background: rgba(26, 26, 46, 0.4);
    border-radius: 6px;
    transition: background 150ms ease;
  }

  .track-item:hover {
    background: rgba(26, 26, 46, 0.7);
  }

  .track-item.in-setlist {
    opacity: 0.5;
  }

  .track-title {
    font-size: 0.85rem;
    color: #f0f0f5;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }

  .add-btn {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 1px solid rgba(0, 245, 255, 0.3);
    background: rgba(0, 245, 255, 0.08);
    color: #00f5ff;
    cursor: pointer;
    transition: all 150ms ease;
    margin-left: 0.5rem;
  }

  .add-btn:hover:not(:disabled) {
    background: rgba(0, 245, 255, 0.2);
    border-color: #00f5ff;
  }

  .add-btn:disabled {
    cursor: default;
    opacity: 0.4;
    border-color: rgba(255, 255, 255, 0.1);
    color: #606070;
    background: transparent;
  }

  .setlist-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 0.75rem;
    background: rgba(26, 26, 46, 0.4);
    border-radius: 6px;
    border: 1px solid transparent;
    cursor: grab;
    transition: all 150ms ease;
    user-select: none;
  }

  .setlist-item:hover {
    background: rgba(26, 26, 46, 0.7);
  }

  .setlist-item.dragging {
    opacity: 0.4;
  }

  .setlist-item.drop-target {
    border-color: #00f5ff;
    background: rgba(0, 245, 255, 0.06);
  }

  .setlist-position {
    font-family: var(--font-mono, monospace);
    font-size: 0.75rem;
    font-weight: 700;
    color: #606070;
    width: 1.25rem;
    text-align: center;
    flex-shrink: 0;
  }

  .drag-handle {
    color: #404050;
    flex-shrink: 0;
    display: flex;
    align-items: center;
  }

  .setlist-track-title {
    font-size: 0.85rem;
    color: #f0f0f5;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .remove-btn {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 1px solid transparent;
    background: transparent;
    color: #606070;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .remove-btn:hover {
    color: #ff4466;
    border-color: rgba(255, 68, 102, 0.3);
    background: rgba(255, 68, 102, 0.1);
  }

  .empty-setlist {
    padding: 2rem 1rem;
    text-align: center;
  }

  .empty-text {
    font-size: 0.85rem;
    color: #606070;
  }

  .setlist-actions {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    flex-wrap: wrap;
  }

  .offline-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 1rem;
    border: 1px solid rgba(0, 245, 255, 0.25);
    border-radius: 8px;
    background: rgba(0, 245, 255, 0.06);
    color: #00f5ff;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .offline-btn:hover:not(:disabled) {
    background: rgba(0, 245, 255, 0.12);
    border-color: rgba(0, 245, 255, 0.4);
  }

  .offline-btn:disabled {
    cursor: default;
    opacity: 0.8;
  }

  .offline-btn.done {
    border-color: rgba(0, 255, 136, 0.3);
    background: rgba(0, 255, 136, 0.08);
    color: #00ff88;
  }

  .prefetch-progress-wrap {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 120px;
  }

  .prefetch-progress-wrap span {
    font-size: 0.75rem;
  }

  .prefetch-bar-bg {
    width: 100%;
    height: 4px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.1);
    overflow: hidden;
  }

  .prefetch-bar-fill {
    height: 100%;
    border-radius: 2px;
    background: #00f5ff;
    transition: width 200ms ease;
  }
</style>
