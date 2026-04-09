<script lang="ts">
  import { Button, GlassCard } from '@nuit-one/ui';
  import { type ExportFormat, exportMix, type Mp3Quality } from '$lib/audio/exporter.js';
  import type { StemPlayer } from '$lib/audio/stem-player.js';
  import type { PlayerStore } from '$lib/stores/player.svelte.js';

  interface Props {
    player: PlayerStore;
    projectName: string;
    onClose: () => void;
  }

  const { player, projectName, onClose }: Props = $props();

  let format = $state<ExportFormat>('wav');
  let mp3Quality = $state<Mp3Quality>(192);
  let exporting = $state(false);
  let error = $state('');

  async function handleExport() {
    if (!player.player) return;
    exporting = true;
    error = '';

    try {
      const buffers = new Map<string, { buffer: AudioBuffer; volume: number; muted: boolean; pan: number }>();
      for (const stem of player.stems) {
        const buf = player.player.getBuffer(stem.name);
        if (buf) {
          buffers.set(stem.name, {
            buffer: buf,
            volume: stem.volume,
            muted: stem.muted,
            pan: stem.pan,
          });
        }
      }

      const blob = await exportMix(buffers, player.duration, 44100, {
        format,
        mp3Kbps: mp3Quality,
      });

      // Download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectName}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Export failed';
    } finally {
      exporting = false;
    }
  }
</script>

<div class="export-overlay" role="dialog" aria-modal="true" aria-labelledby="export-dialog-title">
  <GlassCard padding="lg">
    <div class="export-dialog">
      <h2 class="export-title" id="export-dialog-title">Export Mix</h2>
      <p class="export-subtitle">{projectName}</p>

      <div class="export-options">
        <div class="option-group">
          <span class="option-label" id="export-format-label">Format</span>
          <div class="format-buttons" role="radiogroup" aria-labelledby="export-format-label">
            <button
              class="format-btn" class:active={format === 'wav'}
              role="radio"
              aria-checked={format === 'wav'}
              onclick={() => (format = 'wav')}
            >WAV</button>
            <button
              class="format-btn" class:active={format === 'mp3'}
              role="radio"
              aria-checked={format === 'mp3'}
              onclick={() => (format = 'mp3')}
            >MP3</button>
          </div>
        </div>

        {#if format === 'mp3'}
          <div class="option-group">
            <span class="option-label" id="export-quality-label">Quality</span>
            <div class="format-buttons" role="radiogroup" aria-labelledby="export-quality-label">
              {#each [128, 192, 320] as q}
                <button
                  class="format-btn" class:active={mp3Quality === q}
                  role="radio"
                  aria-checked={mp3Quality === q}
                  onclick={() => (mp3Quality = q as Mp3Quality)}
                >{q} kbps</button>
              {/each}
            </div>
          </div>
        {/if}
      </div>

      {#if error}
        <p class="export-error">{error}</p>
      {/if}

      <div class="export-actions">
        <Button variant="primary" onclick={handleExport} disabled={exporting}>
          {exporting ? 'Exporting...' : 'Export'}
        </Button>
        <Button variant="ghost" onclick={onClose} disabled={exporting}>Cancel</Button>
      </div>
    </div>
  </GlassCard>
</div>

<style>
  .export-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(10, 10, 15, 0.85);
    backdrop-filter: blur(8px);
    z-index: 100;
    padding: 2rem;
  }

  .export-dialog {
    text-align: center;
    max-width: 360px;
    margin: 0 auto;
  }

  .export-title {
    font-size: 1.25rem;
    font-weight: 600;
    margin-bottom: 0.25rem;
  }

  .export-subtitle {
    color: #606070;
    font-size: 0.875rem;
    margin-bottom: 1.5rem;
  }

  .export-options {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .option-group {
    text-align: left;
  }

  .option-label {
    font-size: 0.75rem;
    color: #a0a0b0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.375rem;
    display: block;
  }

  .format-buttons {
    display: flex;
    gap: 0.5rem;
  }

  .format-btn {
    flex: 1;
    padding: 0.5rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: #a0a0b0;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .format-btn:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .format-btn.active {
    color: #00f5ff;
    border-color: rgba(0, 245, 255, 0.4);
    background: rgba(0, 245, 255, 0.08);
  }

  .export-error {
    color: #ff4466;
    font-size: 0.75rem;
    margin-bottom: 1rem;
  }

  .export-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: center;
  }
</style>
