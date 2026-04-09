<script lang="ts">
  import type { PlayerStore } from '$lib/stores/player.svelte.js';

  interface Props {
    player: PlayerStore;
    stemName: string;
  }

  const { player, stemName }: Props = $props();

  const stem = $derived(player.stems.find((s) => s.name === stemName));

  const IR_PRESETS = ['room', 'hall', 'plate'] as const;
  let selectedPreset = $state<string>('room');

  async function loadPreset(preset: string) {
    if (!player.player) return;
    selectedPreset = preset;
    try {
      const response = await fetch(`/ir/${preset}.wav`);
      const arrayBuffer = await response.arrayBuffer();
      const irBuffer = await player.player.audioContext.decodeAudioData(arrayBuffer);
      await player.player.setReverbIR(irBuffer);
    } catch (err) {
      console.error('Failed to load IR preset:', err);
    }
  }
</script>

<div class="reverb-controls">
  <div class="reverb-amount">
    <label class="reverb-label" for="reverb-{stemName}">Reverb</label>
    <input
      id="reverb-{stemName}"
      type="range"
      min="0"
      max="1"
      step="0.01"
      value={stem?.reverbAmount ?? 0}
      oninput={(e) => player.setReverbSend(stemName, parseFloat((e.target as HTMLInputElement).value))}
      class="reverb-slider"
    />
    <span class="reverb-value">{Math.round((stem?.reverbAmount ?? 0) * 100)}%</span>
  </div>

  <div class="preset-selector">
    {#each IR_PRESETS as preset}
      <button
        class="preset-btn" class:active={selectedPreset === preset}
        aria-pressed={selectedPreset === preset}
        onclick={() => loadPreset(preset)}
      >{preset}</button>
    {/each}
  </div>
</div>

<style>
  .reverb-controls {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.5rem 0;
  }

  .reverb-amount {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .reverb-label {
    font-size: 0.75rem;
    font-weight: 500;
    color: #a0a0b0;
    min-width: 3.5rem;
  }

  .reverb-slider {
    flex: 1;
    height: 4px;
    appearance: none;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 2px;
    outline: none;
    cursor: pointer;
  }

  .reverb-slider::-webkit-slider-thumb {
    appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #8b5cf6;
    box-shadow: 0 0 6px rgba(139, 92, 246, 0.4);
    cursor: pointer;
  }

  .reverb-slider::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #8b5cf6;
    box-shadow: 0 0 6px rgba(139, 92, 246, 0.4);
    border: none;
    cursor: pointer;
  }

  .reverb-value {
    font-family: var(--font-mono, monospace);
    font-size: 0.625rem;
    color: #a0a0b0;
    min-width: 2.5rem;
    text-align: right;
  }

  .preset-selector {
    display: flex;
    gap: 0.375rem;
  }

  .preset-btn {
    padding: 0.25rem 0.625rem;
    font-size: 0.625rem;
    font-weight: 600;
    color: #606070;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 4px;
    cursor: pointer;
    text-transform: capitalize;
    transition: all 150ms ease;
  }

  .preset-btn:hover {
    color: #a0a0b0;
    border-color: rgba(255, 255, 255, 0.12);
  }

  .preset-btn.active {
    color: #8b5cf6;
    border-color: rgba(139, 92, 246, 0.4);
    background: rgba(139, 92, 246, 0.08);
  }
</style>
