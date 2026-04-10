<script lang="ts">
  import type { PerformanceResult } from '@nuit-one/shared';
  import { Button, GlassCard } from '@nuit-one/ui';
  import { onDestroy, onMount } from 'svelte';

  interface Props {
    result: PerformanceResult;
    trackTitle: string;
    trackId?: string;
    playerLabel?: string;
    accentColor?: string;
    onReplay: () => void;
    onBack: () => void;
  }

  const { result, trackTitle, trackId, playerLabel, accentColor, onReplay, onBack }: Props = $props();

  function grade(accuracy: number): { letter: string; color: string } {
    if (accuracy >= 95) return { letter: 'S', color: '#00f5ff' };
    if (accuracy >= 90) return { letter: 'A', color: '#00ff88' };
    if (accuracy >= 80) return { letter: 'B', color: '#8b5cf6' };
    if (accuracy >= 70) return { letter: 'C', color: '#f59e0b' };
    if (accuracy >= 60) return { letter: 'D', color: '#ff8844' };
    return { letter: 'F', color: '#ff4466' };
  }

  const g = $derived(grade(result.accuracy));

  let phase = $state<'enter' | 'grade' | 'score' | 'stats' | 'done'>('enter');
  let displayScore = $state(0);
  let showConfetti = $state(false);
  let scoreRafId: number | null = null;
  let prefersReducedMotion = $state(false);

  onMount(() => {
    prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      phase = 'done';
      displayScore = result.totalScore;
      return;
    }

    // Phase progression
    setTimeout(() => { phase = 'grade'; }, 200);
    setTimeout(() => {
      phase = 'score';
      animateScore();
    }, 900);
    setTimeout(() => { phase = 'stats'; }, 1800);
    setTimeout(() => { phase = 'done'; }, 2200);

    // Confetti for S/A grades
    if (result.accuracy >= 90) {
      setTimeout(() => { showConfetti = true; }, 400);
      setTimeout(() => { showConfetti = false; }, 3500);
    }
  });

  onDestroy(() => {
    if (scoreRafId) cancelAnimationFrame(scoreRafId);
  });

  function animateScore() {
    const target = result.totalScore;
    const startTime = performance.now();
    const duration = 800;

    function tick() {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // cubic ease-out
      displayScore = Math.round(target * eased);

      if (t < 1) {
        scoreRafId = requestAnimationFrame(tick);
      }
    }
    scoreRafId = requestAnimationFrame(tick);
  }
</script>

<div class="results-overlay">
  <GlassCard padding="lg">
    <div class="results">
      <h2 class="results-title">Performance Complete</h2>
      {#if playerLabel}
        <p class="player-name" style:color={accentColor ?? '#a0a0b0'}>{playerLabel}</p>
      {/if}
      <p class="track-name">{trackTitle}</p>

      <div class="grade" class:grade-animate={phase !== 'enter' && !prefersReducedMotion} style:color={g.color} style:text-shadow="0 0 30px {g.color}">
        {#if phase === 'enter' && !prefersReducedMotion}
          &nbsp;
        {:else}
          {g.letter}
        {/if}
      </div>

      <div class="score-total">
        {#if phase === 'enter' || phase === 'grade'}
          {#if prefersReducedMotion}
            {result.totalScore.toLocaleString()}
          {:else}
            &nbsp;
          {/if}
        {:else}
          {displayScore.toLocaleString()}
        {/if}
      </div>

      <div class="stats-grid" class:stats-animate={phase !== 'enter' && phase !== 'grade' && phase !== 'score' && !prefersReducedMotion}>
        <div class="stat">
          <span class="stat-value" style:color="#00f5ff">{result.perfectCount}</span>
          <span class="stat-label">Perfect</span>
        </div>
        <div class="stat">
          <span class="stat-value" style:color="#00ff88">{result.greatCount}</span>
          <span class="stat-label">Great</span>
        </div>
        <div class="stat">
          <span class="stat-value" style:color="#f59e0b">{result.goodCount}</span>
          <span class="stat-label">Good</span>
        </div>
        <div class="stat">
          <span class="stat-value" style:color="#ff4466">{result.missCount}</span>
          <span class="stat-label">Miss</span>
        </div>
      </div>

      <div class="meta-stats">
        <div class="meta">
          <span class="meta-label">Max Combo</span>
          <span class="meta-value">{result.maxCombo}x</span>
        </div>
        <div class="meta">
          <span class="meta-label">Accuracy</span>
          <span class="meta-value">{result.accuracy}%</span>
        </div>
      </div>

      <div class="actions">
        <Button variant="primary" onclick={onReplay}>Play Again</Button>
        <Button variant="secondary" onclick={onBack}>Back to Track</Button>
        {#if trackId}
          <a href="/tracks/{trackId}/stats" class="stats-link">View Stats</a>
        {/if}
      </div>
    </div>
  </GlassCard>

  {#if showConfetti}
    <div class="confetti-container" aria-hidden="true">
      {#each Array(25) as _, i}
        <div
          class="confetti-particle"
          style="--x:{Math.random()*100}%;--delay:{Math.random()*0.5}s;--dur:{1.5+Math.random()*1.5}s;--color:{['#00f5ff','#ff00e5','#8b5cf6','#f59e0b','#00ff88'][i%5]}"
        ></div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .results-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(10, 10, 15, 0.85);
    backdrop-filter: blur(8px);
    z-index: 100;
    padding: 2rem;
    animation: nuit-fade-in 300ms ease forwards;
  }

  .results {
    text-align: center;
    max-width: 400px;
    margin: 0 auto;
  }

  .results-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: #a0a0b0;
    margin-bottom: 0.25rem;
  }

  .player-name {
    font-size: 0.875rem;
    font-weight: 600;
    margin-bottom: 0.25rem;
  }

  .track-name {
    font-size: 0.875rem;
    color: #606070;
    margin-bottom: 1.5rem;
  }

  .grade {
    font-size: 5rem;
    font-weight: 900;
    line-height: 1;
    margin-bottom: 0.5rem;
  }

  .score-total {
    font-family: var(--font-mono, monospace);
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: 1.5rem;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
    margin-bottom: 1.25rem;
  }

  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.125rem;
  }

  .stat-value {
    font-family: var(--font-mono, monospace);
    font-size: 1.25rem;
    font-weight: 700;
  }

  .stat-label {
    font-size: 0.625rem;
    color: #606070;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .meta-stats {
    display: flex;
    justify-content: center;
    gap: 2rem;
    margin-bottom: 1.5rem;
    padding-top: 1rem;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .meta {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.125rem;
  }

  .meta-label {
    font-size: 0.625rem;
    color: #606070;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .meta-value {
    font-family: var(--font-mono, monospace);
    font-size: 1rem;
    font-weight: 600;
  }

  .actions {
    display: flex;
    gap: 0.75rem;
    justify-content: center;
    flex-wrap: wrap;
  }

  .stats-link {
    font-size: 0.75rem;
    color: #a0a0b0;
    text-decoration: underline;
    text-underline-offset: 2px;
    transition: color 150ms ease;
    width: 100%;
    text-align: center;
    margin-top: 0.25rem;
  }

  .stats-link:hover {
    color: #00f5ff;
  }

  /* --- Animated reveal --- */

  .grade-animate {
    animation: nuit-scale-bounce 600ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }

  .stats-animate > :global(*) {
    opacity: 0;
    animation: nuit-slide-up 350ms ease forwards;
  }
  .stats-animate > :global(*:nth-child(1)) { animation-delay: 0ms; }
  .stats-animate > :global(*:nth-child(2)) { animation-delay: 100ms; }
  .stats-animate > :global(*:nth-child(3)) { animation-delay: 200ms; }
  .stats-animate > :global(*:nth-child(4)) { animation-delay: 300ms; }

  /* --- Confetti --- */

  .confetti-container {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 150;
    overflow: hidden;
  }

  .confetti-particle {
    position: absolute;
    top: -10px;
    left: var(--x);
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color);
    animation: confetti-fall var(--dur) ease-in var(--delay) forwards;
  }

  @keyframes confetti-fall {
    0% { transform: translateY(0) rotate(0deg); opacity: 1; }
    100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
  }
</style>
