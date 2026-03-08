<script lang="ts">
  import { GlassCard } from '@nuit-one/ui';
  import ScoreTrendChart from '$lib/components/ScoreTrendChart.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  function grade(accuracy: number): { letter: string; color: string } {
    if (accuracy >= 95) return { letter: 'S', color: '#00f5ff' };
    if (accuracy >= 90) return { letter: 'A', color: '#00ff88' };
    if (accuracy >= 80) return { letter: 'B', color: '#8b5cf6' };
    if (accuracy >= 70) return { letter: 'C', color: '#f59e0b' };
    if (accuracy >= 60) return { letter: 'D', color: '#ff8844' };
    return { letter: 'F', color: '#ff4466' };
  }

  function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  const chartData = $derived(
    [...data.performances].reverse().map((p) => ({
      date: p.createdAt,
      score: p.scoreOverall,
      accuracy: p.accuracy,
    }))
  );
</script>

<div class="min-h-screen bg-nuit-base p-8">
  <header class="mb-6">
    <a href="/tracks/{data.track.id}" class="text-text-muted text-sm hover:text-text-secondary">&larr; Back to track</a>
    <h1 class="text-xl font-bold mt-1">{data.track.title}</h1>
    <p class="text-text-muted text-sm">Performance Stats</p>
  </header>

  <main class="mx-auto max-w-3xl space-y-6">
    <!-- Summary stats -->
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <GlassCard padding="sm">
        <div class="text-center">
          <p class="text-text-muted text-xs uppercase tracking-wider">Plays</p>
          <p class="text-2xl font-bold font-mono">{data.stats.totalPlays}</p>
        </div>
      </GlassCard>
      <GlassCard padding="sm">
        <div class="text-center">
          <p class="text-text-muted text-xs uppercase tracking-wider">Best Score</p>
          <p class="text-2xl font-bold font-mono text-neon-cyan">{data.stats.bestScore.toLocaleString()}</p>
        </div>
      </GlassCard>
      <GlassCard padding="sm">
        <div class="text-center">
          <p class="text-text-muted text-xs uppercase tracking-wider">Avg Accuracy</p>
          <p class="text-2xl font-bold font-mono">{data.stats.avgAccuracy}%</p>
        </div>
      </GlassCard>
      <GlassCard padding="sm">
        <div class="text-center">
          <p class="text-text-muted text-xs uppercase tracking-wider">Best Combo</p>
          <p class="text-2xl font-bold font-mono">{data.stats.bestCombo}x</p>
        </div>
      </GlassCard>
    </div>

    <!-- Score trend chart -->
    {#if chartData.length > 0}
      <GlassCard padding="md">
        <h2 class="text-sm font-semibold mb-3">Score Trend</h2>
        <ScoreTrendChart data={chartData} />
      </GlassCard>
    {/if}

    <!-- Recent performances -->
    <GlassCard padding="md">
      <h2 class="text-sm font-semibold mb-3">Recent Performances</h2>
      {#if data.performances.length === 0}
        <p class="text-text-muted text-sm text-center py-6">No performances yet. Play a song to see your stats!</p>
      {:else}
        <div class="space-y-2">
          {#each data.performances as perf (perf.id)}
            {@const g = grade(perf.accuracy)}
            <div class="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
              <div class="flex items-center gap-3">
                <span class="text-2xl font-black" style:color={g.color}>{g.letter}</span>
                <div>
                  <p class="font-mono text-sm">{perf.totalScore.toLocaleString()}</p>
                  <p class="text-text-muted text-xs">{formatDate(perf.createdAt)}</p>
                </div>
              </div>
              <div class="text-right">
                <p class="font-mono text-sm">{perf.accuracy}%</p>
                <p class="text-text-muted text-xs">{perf.maxCombo}x combo</p>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </GlassCard>
  </main>
</div>
