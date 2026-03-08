<script lang="ts">
  import type { PerformanceResult } from '@nuit-one/shared';
  import { GlassCard, Button } from '@nuit-one/ui';

  interface Props {
    result: PerformanceResult;
    trackTitle: string;
    onReplay: () => void;
    onBack: () => void;
  }

  const { result, trackTitle, onReplay, onBack }: Props = $props();

  function grade(accuracy: number): { letter: string; color: string } {
    if (accuracy >= 95) return { letter: 'S', color: '#00f5ff' };
    if (accuracy >= 90) return { letter: 'A', color: '#00ff88' };
    if (accuracy >= 80) return { letter: 'B', color: '#8b5cf6' };
    if (accuracy >= 70) return { letter: 'C', color: '#f59e0b' };
    if (accuracy >= 60) return { letter: 'D', color: '#ff8844' };
    return { letter: 'F', color: '#ff4466' };
  }

  const g = $derived(grade(result.accuracy));
</script>

<div class="results-overlay">
  <GlassCard padding="lg">
    <div class="results">
      <h2 class="results-title">Performance Complete</h2>
      <p class="track-name">{trackTitle}</p>

      <div class="grade" style:color={g.color} style:text-shadow="0 0 30px {g.color}">
        {g.letter}
      </div>

      <div class="score-total">{result.totalScore.toLocaleString()}</div>

      <div class="stats-grid">
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
      </div>
    </div>
  </GlassCard>
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
  }
</style>
