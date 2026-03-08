<script lang="ts">
  import type { HitJudgment } from '@nuit-one/shared';

  interface Props {
    score: number;
    combo: number;
    lastJudgment: HitJudgment | null;
    accuracy: number;
  }

  const { score, combo, lastJudgment, accuracy }: Props = $props();

  const judgmentColors: Record<string, string> = {
    perfect: '#00f5ff',
    great: '#00ff88',
    good: '#f59e0b',
    miss: '#ff4466',
  };

  const judgmentLabels: Record<string, string> = {
    perfect: 'PERFECT',
    great: 'GREAT',
    good: 'GOOD',
    miss: 'MISS',
  };
</script>

<div class="score-display">
  <div class="score-value">{score.toLocaleString()}</div>

  {#if combo > 1}
    <div class="combo">
      <span class="combo-count">{combo}x</span>
      <span class="combo-label">COMBO</span>
    </div>
  {/if}

  {#if lastJudgment}
    <div
      class="judgment"
      style:color={judgmentColors[lastJudgment] ?? '#a0a0b0'}
      style:text-shadow="0 0 12px {judgmentColors[lastJudgment] ?? 'transparent'}"
    >
      {judgmentLabels[lastJudgment] ?? ''}
    </div>
  {/if}

  <div class="accuracy">{accuracy.toFixed(1)}%</div>
</div>

<style>
  .score-display {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.25rem;
    min-width: 8rem;
  }

  .score-value {
    font-family: var(--font-mono, monospace);
    font-size: 1.5rem;
    font-weight: 700;
    color: #f0f0f5;
  }

  .combo {
    display: flex;
    align-items: baseline;
    gap: 0.25rem;
  }

  .combo-count {
    font-family: var(--font-mono, monospace);
    font-size: 1.125rem;
    font-weight: 700;
    color: #f59e0b;
    text-shadow: 0 0 8px rgba(245, 158, 11, 0.4);
  }

  .combo-label {
    font-size: 0.625rem;
    font-weight: 600;
    color: #a0a0b0;
    letter-spacing: 0.1em;
  }

  .judgment {
    font-size: 0.875rem;
    font-weight: 700;
    letter-spacing: 0.15em;
    animation: pop 200ms ease-out;
  }

  @keyframes pop {
    0% { transform: scale(1.3); opacity: 0.6; }
    100% { transform: scale(1); opacity: 1; }
  }

  .accuracy {
    font-family: var(--font-mono, monospace);
    font-size: 0.75rem;
    color: #606070;
  }
</style>
