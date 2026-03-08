<script lang="ts">
  import { GlassCard, Button, NeonBadge } from '@nuit-one/ui';
  import KeyDisplay from './KeyDisplay.svelte';
  import DifficultyBadge from './DifficultyBadge.svelte';
  import ChordChart from './ChordChart.svelte';
  import type { AnalysisStore } from '$lib/stores/analysis.svelte.js';

  interface Props {
    analysis: AnalysisStore;
    currentTime: number;
    duration: number;
    onAnalyze?: () => void;
  }

  let { analysis, currentTime, duration, onAnalyze }: Props = $props();
</script>

<GlassCard padding="md">
  <div class="analysis-panel">
    <div class="panel-header">
      <h3 class="panel-title">AI Analysis</h3>
      {#if analysis.status === 'idle'}
        <Button variant="primary" size="sm" onclick={onAnalyze}>Analyze</Button>
      {:else if analysis.status === 'running'}
        <NeonBadge color="amber">Analyzing... {Math.round(analysis.progress * 100)}%</NeonBadge>
      {:else if analysis.status === 'error'}
        <NeonBadge color="magenta">Error</NeonBadge>
      {/if}
    </div>

    {#if analysis.status === 'error'}
      <p class="error-text">{analysis.errorMessage}</p>
    {/if}

    {#if analysis.status === 'complete'}
      <div class="analysis-results">
        <div class="result-row">
          {#if analysis.key}
            <KeyDisplay keySignature={analysis.key} confidence={analysis.keyConfidence} />
          {/if}
          {#if analysis.bpm}
            <div class="bpm-badge">
              <span class="bpm-value">{analysis.bpm}</span>
              <span class="bpm-label">BPM</span>
            </div>
          {/if}
          {#if analysis.difficultyTier}
            <DifficultyBadge tier={analysis.difficultyTier} />
          {/if}
        </div>

        {#if analysis.chords.length > 0}
          <ChordChart chords={analysis.chords} {currentTime} {duration} />
        {/if}
      </div>
    {/if}
  </div>
</GlassCard>

<style>
  .analysis-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .panel-title {
    font-size: 14px;
    font-weight: 600;
    color: #f0f0f5;
  }

  .error-text {
    color: #ff00e5;
    font-size: 12px;
  }

  .analysis-results {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .result-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .bpm-badge {
    display: inline-flex;
    align-items: baseline;
    gap: 4px;
    padding: 4px 10px;
    background: rgba(0, 245, 255, 0.1);
    border: 1px solid rgba(0, 245, 255, 0.3);
    border-radius: 6px;
    color: #00f5ff;
  }

  .bpm-value {
    font-size: 14px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .bpm-label {
    font-size: 10px;
    font-weight: 500;
    opacity: 0.7;
  }
</style>
