<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { createAudienceReceiver, type AudienceMessage } from '$lib/audience-channel.js';
  import AudienceHighway from '$lib/components/AudienceHighway.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let gameState = $state('waiting');
  let currentTime = $state(0);
  let duration = $state(0);
  let countdown = $state(0);
  let trackTitle = $state(data.track?.title ?? '');
  let players = $state<
    Array<{
      label: string;
      instrument: string;
      color: string;
      score: number;
      combo: number;
      accuracy: number;
      lastJudgment: string | null;
    }>
  >([]);
  let results = $state<
    Array<{
      label: string;
      instrument: string;
      color: string;
      results: {
        totalScore: number;
        maxCombo: number;
        perfectCount: number;
        greatCount: number;
        goodCount: number;
        missCount: number;
        accuracy: number;
        dynamicsScore: number;
      };
    }> | null
  >(null);
  let instrumentNotes = $state<
    Record<string, { notes: any[]; minPitch: number; maxPitch: number; color: string }>
  >({});

  let receiver: ReturnType<typeof createAudienceReceiver> | null = null;

  onMount(() => {
    receiver = createAudienceReceiver(data.track.id, handleMessage);
  });

  onDestroy(() => {
    receiver?.close();
  });

  function handleMessage(msg: AudienceMessage) {
    switch (msg.type) {
      case 'state':
        gameState = msg.gameState;
        currentTime = msg.currentTime;
        duration = msg.duration;
        if (msg.countdown !== undefined) countdown = msg.countdown;
        break;
      case 'scores':
        players = msg.players;
        break;
      case 'track':
        trackTitle = msg.title;
        break;
      case 'results':
        results = msg.players;
        gameState = 'finished';
        break;
      case 'notes':
        instrumentNotes = msg.instruments;
        break;
    }
  }

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

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

  const progressPercent = $derived(duration > 0 ? (currentTime / duration) * 100 : 0);
</script>

<svelte:head>
  <title>Audience - {trackTitle}</title>
</svelte:head>

<div class="audience-page">
  {#if gameState === 'waiting'}
    <div class="waiting-screen">
      <div class="waiting-content">
        <h1 class="waiting-title">{trackTitle}</h1>
        <p class="waiting-text">Waiting for performance to start</p>
        <div class="waiting-dots">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </div>
      </div>
    </div>

  {:else if gameState === 'countdown'}
    <div class="countdown-screen">
      <h2 class="countdown-track-title">{trackTitle}</h2>
      <div class="countdown-number">{countdown}</div>
    </div>

  {:else if gameState === 'playing'}
    <div class="playing-layout">
      <div class="top-bar">
        <h2 class="top-title">{trackTitle}</h2>
        <span class="top-time">{formatTime(currentTime)} / {formatTime(duration)}</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style:width="{progressPercent}%"></div>
      </div>

      <div class="highway-area">
        <AudienceHighway
          instruments={instrumentNotes}
          {currentTime}
          {duration}
        />
      </div>

      <div class="player-panels">
        {#each players as p}
          <div class="player-panel" style:--accent={p.color}>
            <div class="panel-label">{p.label}</div>
            <div class="panel-instrument">{p.instrument}</div>
            <div class="panel-score">{p.score.toLocaleString()}</div>
            <div class="panel-row">
              <span class="panel-combo">{p.combo}x</span>
              <span class="panel-accuracy">{p.accuracy}%</span>
            </div>
            {#if p.lastJudgment}
              <div
                class="panel-judgment"
                class:judgment-perfect={p.lastJudgment === 'perfect'}
                class:judgment-great={p.lastJudgment === 'great'}
                class:judgment-good={p.lastJudgment === 'good'}
                class:judgment-miss={p.lastJudgment === 'miss'}
              >
                {p.lastJudgment.toUpperCase()}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>

  {:else if gameState === 'finished' && results}
    <div class="results-screen">
      <h1 class="results-heading">Performance Complete</h1>
      <h2 class="results-track">{trackTitle}</h2>
      <div class="results-grid">
        {#each results as p}
          <div class="result-card" style:--accent={p.color}>
            <div class="result-label">{p.label}</div>
            <div class="result-instrument">{p.instrument}</div>
            <div class="result-grade" style:color={gradeColor(p.results.accuracy)}>
              {gradeLetter(p.results.accuracy)}
            </div>
            <div class="result-score">{p.results.totalScore.toLocaleString()}</div>
            <div class="result-stats">
              <span class="stat-perfect">{p.results.perfectCount}P</span>
              <span class="stat-great">{p.results.greatCount}G</span>
              <span class="stat-good">{p.results.goodCount}OK</span>
              <span class="stat-miss">{p.results.missCount}M</span>
            </div>
            <div class="result-meta">
              {p.results.maxCombo}x max combo &middot; {p.results.accuracy}%
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  /* ============================================================
     Full-viewport audience view - Nuit Glass aesthetic
     ============================================================ */
  .audience-page {
    position: fixed;
    inset: 0;
    background: #0a0a0f;
    color: #e0e0f0;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    overflow: hidden;
  }

  /* ---- Waiting state ---- */
  .waiting-screen {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
  }

  .waiting-content {
    text-align: center;
  }

  .waiting-title {
    font-size: clamp(1.5rem, 4vw, 3rem);
    font-weight: 800;
    margin-bottom: 0.75rem;
    background: linear-gradient(135deg, #00f5ff, #8b5cf6);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .waiting-text {
    font-size: 1rem;
    color: #606070;
    margin-bottom: 1.5rem;
  }

  .waiting-dots {
    display: flex;
    justify-content: center;
    gap: 0.5rem;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #00f5ff;
    animation: pulse-dot 1.4s ease-in-out infinite;
  }

  .dot:nth-child(2) {
    animation-delay: 0.2s;
  }

  .dot:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes pulse-dot {
    0%, 80%, 100% {
      opacity: 0.2;
      transform: scale(0.8);
    }
    40% {
      opacity: 1;
      transform: scale(1.2);
    }
  }

  /* ---- Countdown state ---- */
  .countdown-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
  }

  .countdown-track-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: #606070;
    margin-bottom: 2rem;
  }

  .countdown-number {
    font-size: 10rem;
    font-weight: 900;
    color: #00f5ff;
    text-shadow: 0 0 80px rgba(0, 245, 255, 0.5);
    line-height: 1;
    animation: count-pulse 1s ease-in-out;
  }

  @keyframes count-pulse {
    0% { transform: scale(0.5); opacity: 0; }
    50% { transform: scale(1.2); opacity: 1; }
    100% { transform: scale(1); opacity: 0.8; }
  }

  /* ---- Playing state ---- */
  .playing-layout {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .top-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1.5rem 0.25rem;
    flex-shrink: 0;
  }

  .top-title {
    font-size: clamp(1rem, 2.5vw, 1.5rem);
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 70%;
  }

  .top-time {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.8rem;
    color: #606070;
    flex-shrink: 0;
  }

  .progress-bar {
    height: 3px;
    background: rgba(255, 255, 255, 0.06);
    flex-shrink: 0;
    margin: 0 1.5rem 0.5rem;
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: #00f5ff;
    border-radius: 2px;
    transition: width 100ms linear;
    box-shadow: 0 0 8px rgba(0, 245, 255, 0.4);
  }

  .highway-area {
    flex: 1;
    min-height: 0;
    padding: 0 1rem;
  }

  .player-panels {
    display: flex;
    gap: 0.75rem;
    padding: 0.75rem 1.5rem;
    flex-shrink: 0;
    overflow-x: auto;
    justify-content: center;
  }

  .player-panel {
    background: rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-left: 3px solid var(--accent, #8b5cf6);
    border-radius: 10px;
    padding: 0.75rem 1.25rem;
    min-width: 160px;
    text-align: center;
  }

  .panel-label {
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--accent, #8b5cf6);
    margin-bottom: 0.125rem;
  }

  .panel-instrument {
    font-size: 0.7rem;
    color: #606070;
    margin-bottom: 0.5rem;
  }

  .panel-score {
    font-family: 'JetBrains Mono', monospace;
    font-size: 1.5rem;
    font-weight: 800;
    line-height: 1.1;
    margin-bottom: 0.25rem;
  }

  .panel-row {
    display: flex;
    justify-content: center;
    gap: 0.75rem;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.7rem;
    color: #808090;
    margin-bottom: 0.25rem;
  }

  .panel-combo {
    color: #f59e0b;
  }

  .panel-accuracy {
    color: #00ff88;
  }

  .panel-judgment {
    font-size: 0.65rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-top: 0.25rem;
  }

  .judgment-perfect {
    color: #00f5ff;
    text-shadow: 0 0 10px rgba(0, 245, 255, 0.5);
  }

  .judgment-great {
    color: #00ff88;
  }

  .judgment-good {
    color: #f59e0b;
  }

  .judgment-miss {
    color: #ff4466;
  }

  /* ---- Results state ---- */
  .results-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 2rem;
    gap: 1rem;
  }

  .results-heading {
    font-size: clamp(1.25rem, 3vw, 2rem);
    font-weight: 800;
    background: linear-gradient(135deg, #00f5ff, #ff00e5);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .results-track {
    font-size: 1rem;
    font-weight: 600;
    color: #606070;
    margin-bottom: 1rem;
  }

  .results-grid {
    display: flex;
    gap: 1.25rem;
    flex-wrap: wrap;
    justify-content: center;
  }

  .result-card {
    background: rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-left: 4px solid var(--accent, #8b5cf6);
    border-radius: 12px;
    padding: 1.5rem 2rem;
    text-align: center;
    min-width: 200px;
  }

  .result-label {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--accent, #8b5cf6);
    margin-bottom: 0.125rem;
  }

  .result-instrument {
    font-size: 0.75rem;
    color: #606070;
    margin-bottom: 0.75rem;
  }

  .result-grade {
    font-size: 4rem;
    font-weight: 900;
    line-height: 1;
    margin-bottom: 0.25rem;
  }

  .result-score {
    font-family: 'JetBrains Mono', monospace;
    font-size: 1.25rem;
    font-weight: 700;
    margin-bottom: 0.75rem;
  }

  .result-stats {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }

  .stat-perfect { color: #00f5ff; }
  .stat-great { color: #00ff88; }
  .stat-good { color: #f59e0b; }
  .stat-miss { color: #ff4466; }

  .result-meta {
    font-size: 0.7rem;
    color: #606070;
  }
</style>
