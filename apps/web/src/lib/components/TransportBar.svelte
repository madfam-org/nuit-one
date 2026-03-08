<script lang="ts">
  import { Button } from '@nuit-one/ui';
  import type { PlayerStore } from '$lib/stores/player.svelte.js';

  interface Props {
    player: PlayerStore;
  }

  const { player }: Props = $props();

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function handleSeek(e: MouseEvent) {
    const bar = e.currentTarget as HTMLElement;
    const rect = bar.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    player.seek(pct * player.duration);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.code === 'Space') {
      e.preventDefault();
      player.togglePlayback();
    } else if (e.code === 'ArrowLeft') {
      player.seek(Math.max(0, player.currentTime - 5));
    } else if (e.code === 'ArrowRight') {
      player.seek(Math.min(player.duration, player.currentTime + 5));
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="transport">
  <Button
    variant="ghost"
    size="sm"
    onclick={() => player.togglePlayback()}
  >
    {#if player.isPlaying}
      <svg viewBox="0 0 24 24" fill="currentColor" class="icon">
        <rect x="6" y="4" width="4" height="16" rx="1" />
        <rect x="14" y="4" width="4" height="16" rx="1" />
      </svg>
    {:else}
      <svg viewBox="0 0 24 24" fill="currentColor" class="icon">
        <path d="M8 5v14l11-7z" />
      </svg>
    {/if}
  </Button>

  <span class="time">{formatTime(player.currentTime)}</span>

  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="seek-bar" onclick={handleSeek}>
    <div class="seek-track">
      <div
        class="seek-fill"
        style:width="{player.duration > 0 ? (player.currentTime / player.duration) * 100 : 0}%"
      ></div>
    </div>
  </div>

  <span class="time">{formatTime(player.duration)}</span>
</div>

<style>
  .transport {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0;
  }

  .icon {
    width: 1.25rem;
    height: 1.25rem;
  }

  .time {
    font-family: var(--font-mono, monospace);
    font-size: 0.75rem;
    color: #a0a0b0;
    min-width: 3rem;
    text-align: center;
  }

  .seek-bar {
    flex: 1;
    cursor: pointer;
    padding: 0.5rem 0;
  }

  .seek-track {
    height: 4px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 2px;
    overflow: hidden;
  }

  .seek-fill {
    height: 100%;
    background: #00f5ff;
    border-radius: 2px;
    transition: width 100ms linear;
    box-shadow: 0 0 6px rgba(0, 245, 255, 0.3);
  }

  .seek-bar:hover .seek-track {
    height: 6px;
  }
</style>
