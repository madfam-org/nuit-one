<script lang="ts">
  
  import { Button, GlassCard } from '@nuit-one/ui';
  import { onMount } from 'svelte';
import { goto } from '$app/navigation';
  import { getSetlistStore } from '$lib/stores/setlist.svelte.js';

  const setlist = getSetlistStore();

  // Redirect if no results
  onMount(() => {
    if (!setlist.isActive || setlist.trackResults.length === 0) {
      goto('/library');
    }
  });

  const stats = $derived(setlist.getCumulativeStats());

  function gradeLetter(accuracy: number): string {
    if (accuracy >= 95) return 'S';
    if (accuracy >= 90) return 'A';
    if (accuracy >= 80) return 'B';
    if (accuracy >= 70) return 'C';
    if (accuracy >= 60) return 'D';
    return 'F';
  }

  function gradeColor(accuracy: number): string {
    if (accuracy >= 95) return '#00f5ff';
    if (accuracy >= 90) return '#00ff88';
    if (accuracy >= 80) return '#8b5cf6';
    if (accuracy >= 70) return '#f59e0b';
    if (accuracy >= 60) return '#ff8844';
    return '#ff4466';
  }

  const overallGrade = $derived(gradeLetter(stats.avgAccuracy));
  const overallColor = $derived(gradeColor(stats.avgAccuracy));

  function replaySetlist() {
    setlist.start();
    const first = setlist.currentTrack;
    if (first) {
      goto(`/perform/${first.trackId}?setlist=true`);
    }
  }

  function newSetlist() {
    setlist.clear();
    goto('/setlist');
  }

  function goHome() {
    setlist.clear();
    goto('/library');
  }
</script>

<div class="results-page">
  <GlassCard padding="lg">
    <div class="results-content">
      <h1 class="results-title">Setlist Complete</h1>

      <div
        class="overall-grade"
        style:color={overallColor}
        style:text-shadow="0 0 40px {overallColor}"
      >
        {overallGrade}
      </div>

      <div class="stats-row">
        <div class="stat-block">
          <span class="stat-value">{stats.totalScore.toLocaleString()}</span>
          <span class="stat-label">Total Score</span>
        </div>
        <div class="stat-block">
          <span class="stat-value">{stats.avgAccuracy}%</span>
          <span class="stat-label">Avg Accuracy</span>
        </div>
        <div class="stat-block">
          <span class="stat-value">{stats.bestCombo}x</span>
          <span class="stat-label">Best Combo</span>
        </div>
        <div class="stat-block">
          <span class="stat-value">{stats.tracksPlayed}</span>
          <span class="stat-label">Tracks Played</span>
        </div>
      </div>

      <div class="track-results-list">
        <h2 class="section-title">Per Track</h2>
        {#each setlist.trackResults as tr, i (tr.trackId + '-' + i)}
          {@const entries = Object.entries(tr.results)}
          {@const bestResult = entries.reduce((best, [, r]) =>
            r.accuracy > best.accuracy ? r : best, entries[0]?.[1] ?? { accuracy: 0, totalScore: 0 } as any
          )}
          <div class="track-result-row">
            <span class="track-number">{i + 1}</span>
            <span class="track-result-title">{tr.title}</span>
            <span class="track-grade" style:color={gradeColor(bestResult.accuracy)}>
              {gradeLetter(bestResult.accuracy)}
            </span>
            <span class="track-score">{bestResult.totalScore.toLocaleString()}</span>
            <span class="track-accuracy">{bestResult.accuracy}%</span>
          </div>
        {/each}
      </div>

      <div class="results-actions">
        <Button variant="primary" onclick={replaySetlist}>Replay Setlist</Button>
        <Button variant="secondary" onclick={newSetlist}>New Setlist</Button>
        <Button variant="ghost" onclick={goHome}>Back to Library</Button>
      </div>
    </div>
  </GlassCard>
</div>

<style>
  .results-page {
    padding: 2rem;
    max-width: 640px;
    margin: 0 auto;
    min-height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .results-content {
    text-align: center;
  }

  .results-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: #a0a0b0;
    margin-bottom: 1rem;
  }

  .overall-grade {
    font-size: 6rem;
    font-weight: 900;
    line-height: 1;
    margin-bottom: 1.5rem;
  }

  .stats-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
    margin-bottom: 2rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .stat-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }

  .stat-value {
    font-family: var(--font-mono, monospace);
    font-size: 1.125rem;
    font-weight: 700;
    color: #f0f0f5;
  }

  .stat-label {
    font-size: 0.625rem;
    color: #606070;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .section-title {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #606070;
    margin-bottom: 0.75rem;
    text-align: left;
  }

  .track-results-list {
    margin-bottom: 2rem;
    text-align: left;
  }

  .track-result-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem;
    background: rgba(26, 26, 46, 0.3);
    border-radius: 6px;
    margin-bottom: 2px;
  }

  .track-number {
    font-family: var(--font-mono, monospace);
    font-size: 0.75rem;
    font-weight: 700;
    color: #606070;
    width: 1.25rem;
    text-align: center;
    flex-shrink: 0;
  }

  .track-result-title {
    flex: 1;
    min-width: 0;
    font-size: 0.85rem;
    color: #f0f0f5;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .track-grade {
    font-size: 1rem;
    font-weight: 900;
    flex-shrink: 0;
  }

  .track-score {
    font-family: var(--font-mono, monospace);
    font-size: 0.8rem;
    font-weight: 600;
    color: #a0a0b0;
    flex-shrink: 0;
  }

  .track-accuracy {
    font-family: var(--font-mono, monospace);
    font-size: 0.75rem;
    color: #606070;
    flex-shrink: 0;
    width: 3rem;
    text-align: right;
  }

  .results-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: center;
    flex-wrap: wrap;
  }

  @media (max-width: 480px) {
    .stats-row {
      grid-template-columns: repeat(2, 1fr);
    }

    .track-score {
      display: none;
    }
  }
</style>
