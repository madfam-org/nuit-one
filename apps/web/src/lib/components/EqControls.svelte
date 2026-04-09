<script lang="ts">
  import type { PlayerStore } from '$lib/stores/player.svelte.js';

  interface Props {
    player: PlayerStore;
    stemName: string;
  }

  const { player, stemName }: Props = $props();

  const stem = $derived(player.stems.find((s) => s.name === stemName));

  const bands = [
    { key: 'low' as const, label: 'Low', freq: '200 Hz', color: '#00f5ff' },
    { key: 'mid' as const, label: 'Mid', freq: '1 kHz', color: '#8b5cf6' },
    { key: 'high' as const, label: 'High', freq: '4 kHz', color: '#ff00e5' },
  ];

  function getValue(band: 'low' | 'mid' | 'high'): number {
    if (!stem) return 0;
    if (band === 'low') return stem.eqLow;
    if (band === 'mid') return stem.eqMid;
    return stem.eqHigh;
  }
</script>

<div class="eq-controls">
  {#each bands as band}
    <div class="eq-band">
      <label class="eq-label" for="eq-{stemName}-{band.key}">{band.label}</label>
      <input
        id="eq-{stemName}-{band.key}"
        type="range"
        min="-12"
        max="12"
        step="0.5"
        value={getValue(band.key)}
        oninput={(e) => player.setEq(stemName, band.key, parseFloat((e.target as HTMLInputElement).value))}
        class="eq-slider"
        style:--eq-color={band.color}
      />
      <span class="eq-value">{getValue(band.key).toFixed(1)} dB</span>
      <span class="eq-freq">{band.freq}</span>
    </div>
  {/each}
</div>

<style>
  .eq-controls {
    display: flex;
    gap: 1rem;
    justify-content: center;
    padding: 0.5rem 0;
  }

  .eq-band {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }

  .eq-label {
    font-size: 0.625rem;
    font-weight: 600;
    color: #a0a0b0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .eq-slider {
    width: 4px;
    height: 80px;
    appearance: none;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 2px;
    outline: none;
    cursor: pointer;
    writing-mode: vertical-lr;
    direction: rtl;
  }

  .eq-slider::-webkit-slider-thumb {
    appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--eq-color, #8b5cf6);
    box-shadow: 0 0 6px var(--eq-color, rgba(139, 92, 246, 0.4));
    cursor: pointer;
  }

  .eq-slider::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--eq-color, #8b5cf6);
    box-shadow: 0 0 6px var(--eq-color, rgba(139, 92, 246, 0.4));
    border: none;
    cursor: pointer;
  }

  .eq-value {
    font-family: var(--font-mono, monospace);
    font-size: 0.625rem;
    color: #a0a0b0;
  }

  .eq-freq {
    font-size: 0.5rem;
    color: #606070;
  }
</style>
