<script lang="ts">
  import type { PerformanceResult } from '@nuit-one/shared';
  import { Button } from '@nuit-one/ui';
  import { onDestroy } from 'svelte';

  interface Props {
    trackTitle: string;
    trackNumber: number;
    totalTracks: number;
    results: PerformanceResult;
    nextTrackTitle: string | null;
    isLastTrack: boolean;
    onNext: () => void;
    onFinish: () => void;
  }

  const {
    trackTitle,
    trackNumber,
    totalTracks,
    results,
    nextTrackTitle,
    isLastTrack,
    onNext,
    onFinish,
  }: Props = $props();

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

  const letter = $derived(gradeLetter(results.accuracy));
  const color = $derived(gradeColor(results.accuracy));

  // Auto-advance countdown (only when not last track)
  let countdown = $state(5);
  let countdownId: ReturnType<typeof setInterval> | null = null;

  $effect(() => {
    if (isLastTrack) return;
    countdownId = setInterval(() => {
      countdown--;
      if (countdown <= 0) {
        if (countdownId) clearInterval(countdownId);
        countdownId = null;
        onNext();
      }
    }, 1000);
    return () => {
      if (countdownId) clearInterval(countdownId);
    };
  });

  function skipToNext() {
    if (countdownId) clearInterval(countdownId);
    countdownId = null;
    onNext();
  }
</script>

<div class="interstitial-overlay">
  <div class="interstitial-content">
    <span class="track-badge">Track {trackNumber} of {totalTracks}</span>

    <h2 class="track-title">{trackTitle}</h2>

    <div class="result-row">
      <span class="grade" style:color={color} style:text-shadow="0 0 20px {color}">{letter}</span>
      <span class="score">{results.totalScore.toLocaleString()}</span>
      <span class="accuracy">{results.accuracy}%</span>
    </div>

    {#if isLastTrack}
      <div class="complete-section">
        <p class="complete-text">Setlist Complete!</p>
        <Button variant="primary" size="lg" onclick={onFinish}>View Results</Button>
      </div>
    {:else}
      <div class="next-section">
        <p class="up-next-label">Up Next:</p>
        <p class="next-title">{nextTrackTitle}</p>
        <div class="countdown-display">{countdown}</div>
        <div class="next-actions">
          <Button variant="primary" onclick={skipToNext}>Next</Button>
          <Button variant="ghost" onclick={onFinish}>End Setlist</Button>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .interstitial-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(10, 10, 15, 0.9);
    backdrop-filter: blur(12px);
    z-index: 100;
    padding: 2rem;
    animation: interstitial-fade-in 300ms ease forwards;
  }

  @keyframes interstitial-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .interstitial-content {
    text-align: center;
    max-width: 420px;
    width: 100%;
  }

  .track-badge {
    display: inline-block;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #00f5ff;
    background: rgba(0, 245, 255, 0.1);
    border: 1px solid rgba(0, 245, 255, 0.2);
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    margin-bottom: 1rem;
  }

  .track-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: #f0f0f5;
    margin-bottom: 1.25rem;
  }

  .result-row {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .grade {
    font-size: 3rem;
    font-weight: 900;
    line-height: 1;
  }

  .score {
    font-family: var(--font-mono, monospace);
    font-size: 1.25rem;
    font-weight: 700;
    color: #f0f0f5;
  }

  .accuracy {
    font-family: var(--font-mono, monospace);
    font-size: 0.875rem;
    color: #a0a0b0;
  }

  .complete-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .complete-text {
    font-size: 1.125rem;
    font-weight: 600;
    color: #00ff88;
    text-shadow: 0 0 16px rgba(0, 255, 136, 0.3);
  }

  .next-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }

  .up-next-label {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #606070;
  }

  .next-title {
    font-size: 1rem;
    font-weight: 600;
    color: #f0f0f5;
  }

  .countdown-display {
    font-family: var(--font-mono, monospace);
    font-size: 2.5rem;
    font-weight: 900;
    color: rgba(0, 245, 255, 0.6);
    line-height: 1;
    margin: 0.5rem 0;
  }

  .next-actions {
    display: flex;
    gap: 0.75rem;
    margin-top: 0.5rem;
  }
</style>
