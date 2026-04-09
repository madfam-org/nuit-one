<script lang="ts">
  
  import { Button, GlassCard } from '@nuit-one/ui';
import { onDestroy } from 'svelte';
  import { CommandStack } from '$lib/audio/command-stack.js';
  import { MuteToggleCommand, PanChangeCommand, SoloCommand, VolumeChangeCommand } from '$lib/audio/commands.js';
  import { extractPeaks } from '$lib/audio/waveform.js';
  import StemMixer from '$lib/components/StemMixer.svelte';
  import TransportBar from '$lib/components/TransportBar.svelte';
  import WaveformDisplay from '$lib/components/WaveformDisplay.svelte';
  import { createPlayerStore } from '$lib/stores/player.svelte.js';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const player = createPlayerStore();
  const commandStack = new CommandStack();

  let peaksMap = $state<Map<string, Float32Array>>(new Map());
  let loaded = $state(false);
  let canUndo = $state(false);
  let canRedo = $state(false);

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

  const hasStemUrls = $derived(Object.keys(data.stemUrls).length > 0);

  async function loadProject() {
    if (!hasStemUrls) return;
    await player.loadStems(data.stemUrls);

    // Extract waveform peaks
    const newPeaks = new Map<string, Float32Array>();
    for (const stemName of player.player?.stemNames ?? []) {
      const buffer = player.player?.getBuffer(stemName);
      if (buffer) {
        const samplesPerPixel = Math.max(1, Math.floor(buffer.length / 800));
        newPeaks.set(stemName, extractPeaks(buffer, samplesPerPixel));
      }
    }
    peaksMap = newPeaks;
    loaded = true;
  }

  // Auto-load
  $effect(() => {
    if (hasStemUrls && !loaded) {
      loadProject();
    }
  });

  function handleUndo() {
    commandStack.undo();
    syncUndoState();
  }

  function handleRedo() {
    commandStack.redo();
    syncUndoState();
  }

  function syncUndoState() {
    canUndo = commandStack.canUndo;
    canRedo = commandStack.canRedo;
  }

  function handleKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.code === 'KeyZ') {
      e.preventDefault();
      if (e.shiftKey) handleRedo();
      else handleUndo();
    }
  }

  onDestroy(() => {
    player.destroy();
  });
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="daw-workspace">
  <!-- Header -->
  <header class="daw-header">
    <div class="header-left">
      <a href="/library" class="back-link" aria-label="Back to library">&larr;</a>
      <h1 class="project-name">{data.project.name}</h1>
      <span class="project-meta">{data.project.tempoBpm} BPM</span>
      <span class="project-meta">{data.project.timeSignature}</span>
      <a href="/studio/{data.project.id}/settings" class="settings-link" aria-label="Project settings">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="settings-icon">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
        </svg>
      </a>
    </div>
    <div class="header-right">
      <Button variant="ghost" size="sm" disabled={!canUndo} onclick={handleUndo}>Undo</Button>
      <Button variant="ghost" size="sm" disabled={!canRedo} onclick={handleRedo}>Redo</Button>
    </div>
  </header>

  {#if !hasStemUrls}
    <div class="empty-state">
      <GlassCard padding="lg">
        <div class="empty-content">
          <p class="empty-text">No tracks with stems yet.</p>
          <p class="empty-sub">Upload a song from the <a href="/dashboard" class="link">dashboard</a> to get started.</p>
        </div>
      </GlassCard>
    </div>
  {:else if player.loading}
    <div class="loading-state">
      <p class="loading-text">Loading stems...</p>
    </div>
  {:else}
    <!-- Timeline -->
    <div class="timeline">
      {#each player.stems as stem (stem.name)}
        {@const color = stemColors[stem.name] ?? '#a0a0b0'}
        <div class="timeline-row">
          <div class="row-label">
            <span class="row-indicator" style:background={color}></span>
            <span class="row-name">{stemLabels[stem.name] ?? stem.name}</span>
            <div class="row-controls">
              <button
                class="mini-btn" class:active={stem.muted}
                onclick={() => {
                  commandStack.execute(new MuteToggleCommand(player, stem.name));
                  syncUndoState();
                }}
              >M</button>
              <button
                class="mini-btn" class:active={stem.solo}
                onclick={() => {
                  commandStack.execute(new SoloCommand(player, stem.name, stem.solo));
                  syncUndoState();
                }}
              >S</button>
            </div>
          </div>
          <div class="row-waveform">
            <WaveformDisplay
              peaks={peaksMap.get(stem.name) ?? null}
              currentTime={player.currentTime}
              duration={player.duration}
              loopStart={player.loopStart}
              loopEnd={player.loopEnd}
              {color}
              onSeek={(t) => player.seek(t)}
              onLoopSelect={(s, e) => player.setLoopRegion(s, e)}
            />
          </div>
        </div>
      {/each}
    </div>

    <!-- Mixer -->
    <div class="mixer-section">
      <StemMixer {player} showPan={true} />
    </div>

    <!-- Transport -->
    <div class="transport-section">
      <TransportBar {player} showLoopControls={true} />
    </div>
  {/if}
</div>

<style>
  .daw-workspace {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #0a0a0f;
    color: #f0f0f5;
  }

  .daw-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .back-link {
    color: #606070;
    text-decoration: none;
    font-size: 1.25rem;
  }

  .back-link:hover {
    color: #a0a0b0;
  }

  .project-name {
    font-size: 1rem;
    font-weight: 600;
  }

  .project-meta {
    font-family: var(--font-mono, monospace);
    font-size: 0.75rem;
    color: #606070;
    padding: 0.125rem 0.5rem;
    background: rgba(255, 255, 255, 0.04);
    border-radius: 4px;
  }

  .settings-link {
    color: #606070;
    transition: color 150ms ease;
  }

  .settings-link:hover {
    color: #a0a0b0;
  }

  .settings-icon {
    width: 1rem;
    height: 1rem;
  }

  .header-right {
    display: flex;
    gap: 0.25rem;
  }

  .empty-state, .loading-state {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
  }

  .empty-content {
    text-align: center;
  }

  .empty-text {
    font-size: 1rem;
    margin-bottom: 0.5rem;
  }

  .empty-sub {
    color: #606070;
    font-size: 0.875rem;
  }

  .link {
    color: #00f5ff;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .loading-text {
    color: #606070;
    font-size: 0.875rem;
  }

  .timeline {
    flex: 1;
    overflow-y: auto;
    padding: 1rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .timeline-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .row-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 10rem;
    flex-shrink: 0;
  }

  .row-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .row-name {
    font-size: 0.75rem;
    font-weight: 500;
    white-space: nowrap;
  }

  .row-controls {
    display: flex;
    gap: 0.25rem;
  }

  .mini-btn {
    font-size: 0.625rem;
    font-weight: 700;
    color: #606070;
    background: none;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 3px;
    padding: 0.125rem 0.375rem;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .mini-btn:hover {
    border-color: rgba(255, 255, 255, 0.2);
    color: #a0a0b0;
  }

  .mini-btn.active {
    color: #00f5ff;
    border-color: rgba(0, 245, 255, 0.4);
    text-shadow: 0 0 6px rgba(0, 245, 255, 0.4);
  }

  .row-waveform {
    flex: 1;
  }

  .mixer-section {
    padding: 0.75rem 1.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .transport-section {
    padding: 0.5rem 1.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(0, 0, 0, 0.3);
  }
</style>
