<script lang="ts">
  interface Props {
    trackTitle?: string;
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    onPlayPause?: () => void;
    onSeek?: (time: number) => void;
  }

  const { trackTitle, isPlaying, currentTime, duration, onPlayPause, onSeek }: Props = $props();

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function handleSeek(e: MouseEvent) {
    const bar = e.currentTarget as HTMLElement;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek?.(ratio * duration);
  }

  let progress = $derived(duration > 0 ? (currentTime / duration) * 100 : 0);
  let hasTrack = $derived(!!trackTitle);
</script>

<div class="bottom-bar" class:has-track={hasTrack}>
  {#if hasTrack}
    <div class="track-info">
      <span class="track-title">{trackTitle}</span>
    </div>

    <div class="controls">
      <button class="play-btn" onclick={onPlayPause} aria-label={isPlaying ? 'Pause' : 'Play'}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          {#if isPlaying}
            <rect x="4" y="3" width="4" height="14" rx="1" fill="currentColor"/>
            <rect x="12" y="3" width="4" height="14" rx="1" fill="currentColor"/>
          {:else}
            <path d="M5 3l12 7-12 7V3z" fill="currentColor"/>
          {/if}
        </svg>
      </button>

      <span class="time">{formatTime(currentTime)}</span>

      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="seek-bar" onclick={handleSeek}>
        <div class="seek-track">
          <div class="seek-progress" style="width: {progress}%"></div>
        </div>
      </div>

      <span class="time">{formatTime(duration)}</span>
    </div>
  {:else}
    <div class="empty-state">
      <span class="empty-text">No track playing</span>
    </div>
  {/if}
</div>

<style>
  .bottom-bar {
    display: flex;
    align-items: center;
    gap: 16px;
    height: 64px;
    padding: 0 16px;
    background: rgba(10, 10, 15, 0.9);
    backdrop-filter: blur(16px);
    border-top: 1px solid rgba(240, 240, 245, 0.08);
    flex-shrink: 0;
  }

  .track-info {
    width: 200px;
    flex-shrink: 0;
  }

  .track-title {
    color: #f0f0f5;
    font-size: 13px;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    display: block;
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
  }

  .play-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 50%;
    background: rgba(0, 245, 255, 0.15);
    color: #00f5ff;
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .play-btn:hover {
    background: rgba(0, 245, 255, 0.25);
    box-shadow: 0 0 16px rgba(0, 245, 255, 0.3);
  }

  .play-btn:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px rgba(0, 245, 255, 0.5);
  }

  .time {
    color: #606070;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    min-width: 36px;
    text-align: center;
    flex-shrink: 0;
  }

  .seek-bar {
    flex: 1;
    padding: 8px 0;
    cursor: pointer;
  }

  .seek-track {
    height: 4px;
    background: rgba(240, 240, 245, 0.1);
    border-radius: 2px;
    overflow: hidden;
  }

  .seek-progress {
    height: 100%;
    background: #00f5ff;
    border-radius: 2px;
    transition: width 0.1s linear;
  }

  .empty-state {
    flex: 1;
    display: flex;
    justify-content: center;
  }

  .empty-text {
    color: #606070;
    font-size: 13px;
  }
</style>
