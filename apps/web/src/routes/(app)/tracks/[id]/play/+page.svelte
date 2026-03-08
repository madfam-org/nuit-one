<script lang="ts">
  import { goto } from '$app/navigation';
  import { onDestroy } from 'svelte';
  import type { HitJudgment, NoteEvent, PerformanceResult } from '@nuit-one/shared';
  import { createPlayerStore } from '$lib/stores/player.svelte.js';
  import { PitchDetector } from '$lib/audio/pitch-detector.js';
  import { ScoringEngine } from '$lib/audio/scoring-engine.js';
  import NoteHighway from '$lib/components/NoteHighway.svelte';
  import ScoreDisplay from '$lib/components/ScoreDisplay.svelte';
  import ResultsScreen from '$lib/components/ResultsScreen.svelte';
  import { GlassCard, Button } from '@nuit-one/ui';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  type GameState = 'idle' | 'countdown' | 'playing' | 'finished';

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  const player = createPlayerStore();
  let pitchDetector: PitchDetector | null = null;
  let scoringEngine: ScoringEngine | null = null;

  let gameState = $state<GameState>('idle');
  let countdown = $state(3);
  let score = $state(0);
  let combo = $state(0);
  let lastJudgment = $state<HitJudgment | null>(null);
  let accuracy = $state(0);
  let results = $state<PerformanceResult | null>(null);
  let recentJudgments = $state<Array<{ noteIndex: number; judgment: HitJudgment }>>([]);
  let micError = $state(false);

  let scoreTickId: number | null = null;

  async function startGame() {
    // Load audio stems
    await player.loadStems(data.stemUrls, true);

    // Init scoring engine
    scoringEngine = new ScoringEngine(data.notes);

    // Init pitch detector
    if (player.player?.audioContext) {
      pitchDetector = new PitchDetector(player.player.audioContext);
    }

    // Countdown
    gameState = 'countdown';
    countdown = 3;

    const countdownInterval = setInterval(() => {
      countdown--;
      if (countdown <= 0) {
        clearInterval(countdownInterval);
        beginPlayback();
      }
    }, 1000);
  }

  async function beginPlayback() {
    gameState = 'playing';

    // Start audio playback
    player.play();

    // Start pitch detection
    try {
      await pitchDetector?.start();
    } catch (err) {
      console.warn('Mic access denied or unavailable:', err);
      micError = true;
    }

    // Start scoring loop
    scoreTick();
  }

  function scoreTick() {
    if (gameState !== 'playing' || !scoringEngine) return;

    const time = player.currentTime;

    // Evaluate pitch detection
    if (pitchDetector?.running && pitchDetector.currentMidiNote > 0) {
      const judgment = scoringEngine.evaluate(time, pitchDetector.currentMidiNote);
      if (judgment) {
        lastJudgment = judgment.judgment;
        recentJudgments = [...recentJudgments.slice(-20), {
          noteIndex: judgment.noteIndex,
          judgment: judgment.judgment,
        }];
      }
    }

    // Check for misses
    scoringEngine.checkMisses(time);

    // Update display
    score = scoringEngine.totalScore;
    combo = scoringEngine.combo;
    const res = scoringEngine.getResults();
    accuracy = res.accuracy;

    // Check if song finished
    if (time >= player.duration - 0.5) {
      endGame();
      return;
    }

    scoreTickId = requestAnimationFrame(scoreTick);
  }

  function endGame() {
    gameState = 'finished';
    player.pause();
    pitchDetector?.stop();

    if (scoreTickId) cancelAnimationFrame(scoreTickId);

    if (scoringEngine) {
      results = scoringEngine.getResults();
    }
  }

  function replay() {
    results = null;
    recentJudgments = [];
    score = 0;
    combo = 0;
    lastJudgment = null;
    accuracy = 0;
    gameState = 'idle';
    player.destroy();
    startGame();
  }

  function goBack() {
    player.destroy();
    pitchDetector?.stop();
    goto(`/tracks/${data.track.id}`);
  }

  onDestroy(() => {
    if (scoreTickId) cancelAnimationFrame(scoreTickId);
    pitchDetector?.stop();
    player.destroy();
  });
</script>

<div class="performance-page">
  {#if gameState === 'idle'}
    <div class="idle-screen">
      <GlassCard padding="lg">
        <div class="idle-content">
          <h1 class="idle-title">{data.track.title}</h1>
          <p class="idle-subtitle">Bass Karaoke — Performance Mode</p>

          {#if !data.hasNotes}
            <p class="idle-warning">
              No note data available. Transcribe the bass stem first from the track page.
            </p>
            <Button variant="secondary" onclick={goBack}>Back to Track</Button>
          {:else}
            <p class="idle-info">
              {data.notes.length} notes · Plug in your bass and hit Start!
            </p>
            <div class="idle-actions">
              <Button variant="primary" size="lg" onclick={startGame}>Start Performance</Button>
              <Button variant="ghost" onclick={goBack}>Back</Button>
            </div>
          {/if}
        </div>
      </GlassCard>
    </div>

  {:else if gameState === 'countdown'}
    <div class="countdown-screen">
      <div class="countdown-number">{countdown}</div>
    </div>

  {:else if gameState === 'playing'}
    <div class="playing-layout">
      {#if micError}
        <div class="mic-warning">Microphone unavailable — scoring disabled</div>
      {/if}
      <div class="score-area">
        <ScoreDisplay {score} {combo} {lastJudgment} {accuracy} />
      </div>

      <div class="highway-area">
        <NoteHighway
          notes={data.notes}
          currentTime={player.currentTime}
          {recentJudgments}
        />
      </div>

      <div class="transport-area">
        <div class="transport-info">
          <span class="time-display">
            {formatTime(player.currentTime)} / {formatTime(player.duration)}
          </span>
          <Button variant="ghost" size="sm" onclick={endGame}>End Early</Button>
        </div>
      </div>
    </div>
  {/if}

  {#if results}
    <ResultsScreen
      result={results}
      trackTitle={data.track.title}
      onReplay={replay}
      onBack={goBack}
    />
  {/if}
</div>

<style>
  .performance-page {
    min-height: 100vh;
    background: #0a0a0f;
  }

  .idle-screen {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 2rem;
  }

  .idle-content {
    text-align: center;
    max-width: 400px;
    margin: 0 auto;
  }

  .idle-title {
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: 0.25rem;
  }

  .idle-subtitle {
    color: #a0a0b0;
    font-size: 0.875rem;
    margin-bottom: 1.5rem;
  }

  .idle-info {
    color: #606070;
    font-size: 0.875rem;
    margin-bottom: 1.5rem;
  }

  .idle-warning {
    color: #f59e0b;
    font-size: 0.875rem;
    margin-bottom: 1rem;
  }

  .idle-actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }

  .countdown-screen {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
  }

  .countdown-number {
    font-size: 8rem;
    font-weight: 900;
    color: #00f5ff;
    text-shadow: 0 0 60px rgba(0, 245, 255, 0.5);
    animation: countPulse 1s ease-in-out;
  }

  @keyframes countPulse {
    0% { transform: scale(0.5); opacity: 0; }
    50% { transform: scale(1.2); opacity: 1; }
    100% { transform: scale(1); opacity: 0.8; }
  }

  .playing-layout {
    display: flex;
    flex-direction: column;
    height: 100vh;
    padding: 1rem;
  }

  .score-area {
    display: flex;
    justify-content: flex-end;
    padding: 0.5rem 0;
  }

  .highway-area {
    flex: 1;
    display: flex;
    align-items: center;
  }

  .transport-area {
    padding: 0.5rem 0;
  }

  .transport-info {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .time-display {
    font-family: var(--font-mono, monospace);
    font-size: 0.75rem;
    color: #606070;
  }

  .mic-warning {
    background: rgba(245, 158, 11, 0.15);
    border: 1px solid rgba(245, 158, 11, 0.4);
    color: #f59e0b;
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    font-size: 0.75rem;
    text-align: center;
  }
</style>

