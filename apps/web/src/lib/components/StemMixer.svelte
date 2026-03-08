<script lang="ts">
  import { Button } from '@nuit-one/ui';
  import type { PlayerStore } from '$lib/stores/player.svelte.js';

  interface Props {
    player: PlayerStore;
    showPan?: boolean;
  }

  const { player, showPan = false }: Props = $props();

  const stemColors: Record<string, string> = {
    bass: '#00f5ff',
    no_bass: '#ff00e5',
    vocals: '#8b5cf6',
    drums: '#f59e0b',
    other: '#00ff88',
  };

  const stemLabels: Record<string, string> = {
    bass: 'Bass',
    no_bass: 'Backing Track',
    vocals: 'Vocals',
    drums: 'Drums',
    other: 'Other',
  };
</script>

<div class="mixer">
  {#each player.stems as stem (stem.name)}
    {@const color = stemColors[stem.name] ?? '#a0a0b0'}
    <div class="stem-channel">
      <div class="stem-header">
        <span class="stem-indicator" style:background={color}></span>
        <span class="stem-name">{stemLabels[stem.name] ?? stem.name}</span>
      </div>

      <div class="stem-controls">
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={stem.muted ? 0 : stem.volume}
          oninput={(e) => player.setVolume(stem.name, parseFloat((e.target as HTMLInputElement).value))}
          class="volume-slider"
          style:--slider-color={color}
        />

        {#if showPan}
          <input
            type="range"
            min="-1"
            max="1"
            step="0.01"
            value={stem.pan}
            oninput={(e) => player.setPan(stem.name, parseFloat((e.target as HTMLInputElement).value))}
            class="pan-slider"
            title="Pan: {stem.pan > 0 ? 'R' : stem.pan < 0 ? 'L' : 'C'}{Math.abs(Math.round(stem.pan * 100))}"
          />
        {/if}

        <Button
          variant="ghost"
          size="sm"
          onclick={() => player.toggleMute(stem.name)}
        >
          <span class="btn-label" class:active={stem.muted} style:--active-color={color}>
            M
          </span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onclick={() => stem.solo ? player.unsolo() : player.solo(stem.name)}
        >
          <span class="btn-label" class:active={stem.solo} style:--active-color={color}>
            S
          </span>
        </Button>
      </div>
    </div>
  {/each}
</div>

<style>
  .mixer {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .stem-channel {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.5rem 0;
  }

  .stem-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 8rem;
  }

  .stem-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    box-shadow: 0 0 6px currentColor;
  }

  .stem-name {
    font-size: 0.875rem;
    font-weight: 500;
  }

  .stem-controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
  }

  .volume-slider {
    flex: 1;
    height: 4px;
    appearance: none;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 2px;
    outline: none;
    cursor: pointer;
  }

  .volume-slider::-webkit-slider-thumb {
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--slider-color, #00f5ff);
    box-shadow: 0 0 8px var(--slider-color, rgba(0, 245, 255, 0.4));
    cursor: pointer;
  }

  .volume-slider::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--slider-color, #00f5ff);
    box-shadow: 0 0 8px var(--slider-color, rgba(0, 245, 255, 0.4));
    border: none;
    cursor: pointer;
  }

  .pan-slider {
    width: 60px;
    height: 4px;
    appearance: none;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 2px;
    outline: none;
    cursor: pointer;
  }

  .pan-slider::-webkit-slider-thumb {
    appearance: none;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #a0a0b0;
    cursor: pointer;
  }

  .pan-slider::-moz-range-thumb {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #a0a0b0;
    border: none;
    cursor: pointer;
  }

  .btn-label {
    font-size: 0.75rem;
    font-weight: 700;
    color: #606070;
    transition: color 150ms ease;
  }

  .btn-label.active {
    color: var(--active-color, #00f5ff);
    text-shadow: 0 0 8px var(--active-color, rgba(0, 245, 255, 0.4));
  }
</style>
