<script lang="ts">
  import { Button } from '@nuit-one/ui';
  import { Metronome } from '$lib/audio/metronome.js';
  import type { PlayerStore } from '$lib/stores/player.svelte.js';

  interface Props {
    player: PlayerStore;
    showLoopControls?: boolean;
    audioContext?: AudioContext;
    tempoBpm?: number;
  }

  const { player, showLoopControls = false, audioContext, tempoBpm = 120 }: Props = $props();

  let metronome: Metronome | null = null;
  let metronomeActive = $state(false);

  function toggleMetronome() {
    if (!audioContext) return;
    if (!metronome) {
      metronome = new Metronome(audioContext, tempoBpm);
    }
    if (metronomeActive) {
      metronome.stop();
      metronomeActive = false;
    } else {
      metronome.start();
      metronomeActive = true;
    }
  }

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
    } else if (showLoopControls && e.code === 'KeyL' && !e.metaKey && !e.ctrlKey) {
      if (player.isLooping) {
        player.clearLoopRegion();
      }
    } else if (showLoopControls && e.code === 'BracketLeft') {
      // Set loop start at current time
      const end = player.loopEnd ?? player.duration;
      if (player.currentTime < end) {
        player.setLoopRegion(player.currentTime, end);
      }
    } else if (showLoopControls && e.code === 'BracketRight') {
      // Set loop end at current time
      const start = player.loopStart ?? 0;
      if (player.currentTime > start) {
        player.setLoopRegion(start, player.currentTime);
      }
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="transport">
  <div class="transport-buttons">
    <Button
      variant="ghost"
      size="sm"
      aria-label={player.isPlaying ? 'Pause' : 'Play'}
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

    <Button
      variant="ghost"
      size="sm"
      aria-label="Stop"
      onclick={() => player.stop()}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" class="icon">
        <rect x="6" y="6" width="12" height="12" rx="1" />
      </svg>
    </Button>

    {#if showLoopControls}
      <Button
        variant="ghost"
        size="sm"
        aria-label={player.isLooping ? 'Disable loop' : 'Enable loop'}
        onclick={() => player.isLooping ? player.clearLoopRegion() : player.setLoopRegion(0, player.duration)}
      >
        <span class="loop-label" class:active={player.isLooping}>L</span>
      </Button>

      {#if player.isLooping && player.loopStart !== null && player.loopEnd !== null}
        <span class="loop-info">
          {formatTime(player.loopStart)} - {formatTime(player.loopEnd)}
        </span>
      {/if}
    {/if}

    {#if audioContext}
      <Button
        variant="ghost"
        size="sm"
        aria-label={metronomeActive ? 'Disable metronome' : 'Enable metronome'}
        onclick={toggleMetronome}
      >
        <span class="metronome-label" class:active={metronomeActive}>
          {tempoBpm}
        </span>
      </Button>
    {/if}
  </div>

  <span class="time">{formatTime(player.currentTime)}</span>

  <div
    class="seek-bar"
    role="slider"
    tabindex={0}
    aria-label="Seek position"
    aria-valuemin={0}
    aria-valuemax={player.duration}
    aria-valuenow={player.currentTime}
    onclick={handleSeek}
    onkeydown={(e) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        player.seek(Math.max(0, player.currentTime - 5));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        player.seek(Math.min(player.duration, player.currentTime + 5));
      }
    }}
  >
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

  .transport-buttons {
    display: flex;
    align-items: center;
    gap: 0.25rem;
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

  .loop-label {
    font-size: 0.75rem;
    font-weight: 700;
    color: #606070;
    transition: color 150ms ease;
  }

  .loop-label.active {
    color: #00f5ff;
    text-shadow: 0 0 8px rgba(0, 245, 255, 0.4);
  }

  .loop-info {
    font-family: var(--font-mono, monospace);
    font-size: 0.625rem;
    color: #00f5ff;
    opacity: 0.7;
  }

  .metronome-label {
    font-family: var(--font-mono, monospace);
    font-size: 0.625rem;
    font-weight: 700;
    color: #606070;
    transition: color 150ms ease;
  }

  .metronome-label.active {
    color: #f59e0b;
    text-shadow: 0 0 8px rgba(245, 158, 11, 0.4);
  }
</style>
