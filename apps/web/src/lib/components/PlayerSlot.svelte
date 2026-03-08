<script lang="ts">
  import { INSTRUMENT_LABELS, INSTRUMENT_COLORS } from '@nuit-one/shared';
  import type { PlayableInstrument } from '@nuit-one/shared';
  import type { AudioInputDevice } from '$lib/audio/device-manager.js';

  interface Props {
    playerIndex: number;
    availableInstruments: string[];
    audioDevices: AudioInputDevice[];
    takenInstruments: PlayableInstrument[];
    selectedInstrument: PlayableInstrument | null;
    selectedDeviceId: string | null;
    noteCount: number;
    onInstrumentChange: (instrument: PlayableInstrument | null) => void;
    onDeviceChange: (deviceId: string | null) => void;
    removable?: boolean;
    onRemove?: () => void;
  }

  const {
    playerIndex, availableInstruments, audioDevices, takenInstruments,
    selectedInstrument, selectedDeviceId, noteCount,
    onInstrumentChange, onDeviceChange,
    removable = false, onRemove,
  }: Props = $props();

  const selectableInstruments = $derived(
    availableInstruments.filter(
      i => i === selectedInstrument || !takenInstruments.includes(i as PlayableInstrument)
    )
  );

  const accentColor = $derived(
    selectedInstrument ? INSTRUMENT_COLORS[selectedInstrument] : '#606070'
  );
</script>

<div class="player-slot" style:--accent={accentColor}>
  <div class="slot-header">
    <span class="player-label">Player {playerIndex + 1}</span>
    {#if removable && onRemove}
      <button class="remove-btn" onclick={onRemove}>&times;</button>
    {/if}
  </div>

  <div class="slot-controls">
    <select
      class="slot-select"
      value={selectedInstrument ?? ''}
      onchange={(e) => {
        const val = (e.target as HTMLSelectElement).value;
        onInstrumentChange(val ? val as PlayableInstrument : null);
      }}
    >
      <option value="">Select instrument...</option>
      {#each selectableInstruments as inst}
        <option value={inst}>{INSTRUMENT_LABELS[inst as PlayableInstrument] ?? inst}</option>
      {/each}
    </select>

    {#if audioDevices.length > 1}
      <select
        class="slot-select device-select"
        value={selectedDeviceId ?? ''}
        onchange={(e) => {
          const val = (e.target as HTMLSelectElement).value;
          onDeviceChange(val || null);
        }}
      >
        <option value="">Default mic</option>
        {#each audioDevices as dev}
          <option value={dev.deviceId}>{dev.label}</option>
        {/each}
      </select>
    {/if}
  </div>

  {#if selectedInstrument && noteCount > 0}
    <span class="note-info">{noteCount} notes</span>
  {/if}
</div>

<style>
  .player-slot {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-left: 3px solid var(--accent);
    border-radius: 0.5rem;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .slot-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .player-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--accent);
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .remove-btn {
    background: none;
    border: none;
    color: #606070;
    font-size: 1.125rem;
    cursor: pointer;
    padding: 0 0.25rem;
    line-height: 1;
    transition: color 150ms ease;
  }

  .remove-btn:hover {
    color: #ff4466;
  }

  .slot-controls {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .slot-select {
    flex: 1;
    min-width: 140px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 0.375rem;
    color: #f0f0f5;
    padding: 0.375rem 0.5rem;
    font-size: 0.8rem;
    cursor: pointer;
  }

  .slot-select:focus {
    outline: none;
    border-color: var(--accent);
  }

  .device-select {
    flex: 1.5;
  }

  .note-info {
    font-size: 0.7rem;
    color: #606070;
  }
</style>
