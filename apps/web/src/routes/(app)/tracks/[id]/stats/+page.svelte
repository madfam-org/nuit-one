<script lang="ts">
  import { GlassCard, TabBar } from '@nuit-one/ui';
  import ScoreTrendChart from '$lib/components/ScoreTrendChart.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let activeTab = $state('my-stats');

  const tabs = [
    { id: 'my-stats', label: 'My Stats' },
    { id: 'leaderboard', label: 'Leaderboard' },
  ];

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
    <div class="tab-wrapper">
      <TabBar {tabs} {activeTab} onTabChange={(id) => (activeTab = id)} />
    </div>

    {#if activeTab === 'my-stats'}
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
    {/if}

    {#if activeTab === 'leaderboard'}
      <div class="leaderboard" role="list" aria-label="Track leaderboard">
        {#each data.leaderboard as entry (entry.userId)}
          <div
            class="leaderboard-entry"
            class:current-user={entry.isCurrentUser}
            role="listitem"
          >
            <div
              class="rank"
              class:gold={entry.rank === 1}
              class:silver={entry.rank === 2}
              class:bronze={entry.rank === 3}
            >
              {entry.rank}
            </div>
            <div class="player-info">
              <span class="player-name">{entry.displayName}</span>
              <span class="play-count">{entry.playCount} play{entry.playCount !== 1 ? 's' : ''}</span>
            </div>
            <div class="player-scores">
              <span class="score-item best-score">{entry.bestScore.toLocaleString()}</span>
              <span class="score-item best-accuracy">{entry.bestAccuracy}%</span>
              <span class="score-item best-combo">{entry.bestCombo}x</span>
            </div>
          </div>
        {/each}
        {#if data.leaderboard.length === 0}
          <p class="empty-leaderboard">No performances yet. Be the first to play!</p>
        {/if}
      </div>
    {/if}
  </main>
</div>

<style>
  .tab-wrapper {
    margin-bottom: 0.5rem;
  }

  .leaderboard {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .leaderboard-entry {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: rgba(26, 26, 46, 0.5);
    backdrop-filter: blur(12px);
    border-radius: 8px;
    border: 1px solid rgba(240, 240, 245, 0.06);
    transition: background 150ms ease;
  }

  .leaderboard-entry:hover {
    background: rgba(26, 26, 46, 0.7);
  }

  .leaderboard-entry.current-user {
    border-left: 3px solid #00f5ff;
    background: rgba(0, 245, 255, 0.04);
  }

  .rank {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    font-size: 0.875rem;
    font-weight: 700;
    font-family: var(--font-mono, monospace);
    flex-shrink: 0;
    background: rgba(96, 96, 112, 0.2);
    color: #a0a0b0;
  }

  .rank.gold {
    background: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
    box-shadow: 0 0 8px rgba(245, 158, 11, 0.2);
  }

  .rank.silver {
    background: rgba(160, 160, 176, 0.15);
    color: #a0a0b0;
    box-shadow: 0 0 8px rgba(160, 160, 176, 0.15);
  }

  .rank.bronze {
    background: rgba(205, 127, 50, 0.15);
    color: #cd7f32;
    box-shadow: 0 0 8px rgba(205, 127, 50, 0.15);
  }

  .player-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
  }

  .player-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: #f0f0f5;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .play-count {
    font-size: 0.6875rem;
    color: #606070;
  }

  .player-scores {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-shrink: 0;
  }

  .score-item {
    font-family: var(--font-mono, monospace);
    font-size: 0.8125rem;
    color: #a0a0b0;
  }

  .best-score {
    font-weight: 600;
    color: #f0f0f5;
  }

  .best-accuracy {
    color: #00ff88;
  }

  .best-combo {
    color: #8b5cf6;
  }

  .empty-leaderboard {
    text-align: center;
    padding: 3rem 1rem;
    font-size: 0.875rem;
    color: #606070;
  }

  /* Responsive: stack scores on mobile */
  @media (max-width: 640px) {
    .leaderboard-entry {
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .player-scores {
      width: 100%;
      padding-left: calc(36px + 0.75rem);
      gap: 0.75rem;
    }

    .score-item {
      font-size: 0.75rem;
    }
  }
</style>
