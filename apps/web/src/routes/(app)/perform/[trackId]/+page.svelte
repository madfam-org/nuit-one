<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount, onDestroy } from 'svelte';
  import type { HitJudgment, NoteEvent, PerformanceResult } from '@nuit-one/shared';
  import {
    INSTRUMENT_LABELS, INSTRUMENT_COLORS,
    INSTRUMENT_FREQUENCY_RANGES, INSTRUMENT_MIDI_RANGES,
  } from '@nuit-one/shared';
  import type { PlayableInstrument } from '@nuit-one/shared';
  import { createPlayerStore } from '$lib/stores/player.svelte.js';
  import { PitchDetector } from '$lib/audio/pitch-detector.js';
  import { ScoringEngine } from '$lib/audio/scoring-engine.js';
  import { getAudioInputDevices, type AudioInputDevice } from '$lib/audio/device-manager.js';
  import NoteHighway from '$lib/components/NoteHighway.svelte';
  import ScoreDisplay from '$lib/components/ScoreDisplay.svelte';
  import ResultsScreen from '$lib/components/ResultsScreen.svelte';
  import PlayerSlot from '$lib/components/PlayerSlot.svelte';
  import { GlassCard, Button } from '@nuit-one/ui';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  type GameState = 'idle' | 'countdown' | 'playing' | 'finished';

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

  // --- Multi-player state ---
  interface PlayerConfig {
    instrument: PlayableInstrument | null;
    deviceId: string | null;
    pitchDetector: PitchDetector | null;
    scoringEngine: ScoringEngine | null;
    score: number;
    combo: number;
    lastJudgment: HitJudgment | null;
    accuracy: number;
    results: PerformanceResult | null;
    recentJudgments: Array<{ noteIndex: number; judgment: HitJudgment }>;
    micError: boolean;
  }

  function createDefaultPlayerConfig(): PlayerConfig {
    return {
      instrument: null,
      deviceId: null,
      pitchDetector: null,
      scoringEngine: null,
      score: 0,
      combo: 0,
      lastJudgment: null,
      accuracy: 0,
      results: null,
      recentJudgments: [],
      micError: false,
    };
  }

  const player = createPlayerStore();
  let gameState = $state<GameState>('idle');
  let countdown = $state(3);
  let scoreTickId: number | null = null;

  let playerCount = $state(1);
  let players = $state<PlayerConfig[]>([createDefaultPlayerConfig()]);
  let audioDevices = $state<AudioInputDevice[]>([]);

  const activePlayers = $derived(players.filter(p => p.instrument !== null));
  const takenInstruments = $derived(
    players.map(p => p.instrument).filter((i): i is PlayableInstrument => i !== null)
  );
  const canStart = $derived(activePlayers.length > 0);

  function addPlayer() {
    if (playerCount >= data.availableInstruments.length) return;
    playerCount++;
    players = [...players, createDefaultPlayerConfig()];
  }

  function removePlayer(index: number) {
    if (playerCount <= 1) return;
    players = players.filter((_, i) => i !== index);
    playerCount--;
  }

  // Load audio devices on mount
  onMount(async () => {
    try {
      audioDevices = await getAudioInputDevices();
    } catch {
      // Mic permission denied or unavailable — will handle per-player
    }
  });

  async function startGame() {
    if (!canStart) return;

    // Load all stems
    await player.loadStems(data.stemUrls);

    // Mute all instruments being played
    for (const p of activePlayers) {
      player.toggleMute(p.instrument!);
    }

    // Init scoring + pitch detectors per player
    for (const p of activePlayers) {
      const notes = data.stemsWithNotes[p.instrument!]?.notes ?? [];
      p.scoringEngine = new ScoringEngine(notes);

      if (player.player?.audioContext) {
        const range = INSTRUMENT_FREQUENCY_RANGES[p.instrument!];
        p.pitchDetector = new PitchDetector(player.player.audioContext, {
          minFrequency: range.min,
          maxFrequency: range.max,
          deviceId: p.deviceId ?? undefined,
        });
      }
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
    player.play();

    // Start pitch detection for each player
    for (const p of activePlayers) {
      try {
        await p.pitchDetector?.start();
      } catch (err) {
        console.warn('Mic access denied or unavailable:', err);
        p.micError = true;
      }
    }

    scoreTick();
  }

  function scoreTick() {
    if (gameState !== 'playing') return;

    const time = player.currentTime;

    // Evaluate each player independently
    for (const p of activePlayers) {
      if (!p.scoringEngine) continue;

      if (p.pitchDetector?.running && p.pitchDetector.currentMidiNote > 0) {
        const judgment = p.scoringEngine.evaluate(time, p.pitchDetector.currentMidiNote);
        if (judgment) {
          p.lastJudgment = judgment.judgment;
          p.recentJudgments = [...p.recentJudgments.slice(-20), {
            noteIndex: judgment.noteIndex,
            judgment: judgment.judgment,
          }];
        }
      }

      p.scoringEngine.checkMisses(time);
      p.score = p.scoringEngine.totalScore;
      p.combo = p.scoringEngine.combo;
      const res = p.scoringEngine.getResults();
      p.accuracy = res.accuracy;
    }

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

    if (scoreTickId) cancelAnimationFrame(scoreTickId);

    // Finalize each player
    for (const p of activePlayers) {
      p.pitchDetector?.stop();

      if (p.scoringEngine) {
        p.results = p.scoringEngine.getResults();

        const stemId = data.stemsWithNotes[p.instrument!]?.stemId ?? null;
        // Save performance (fire-and-forget)
        fetch('/api/performances', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trackId: data.track.id,
            stemId,
            ...p.results,
          }),
        }).catch((err) => console.error('Failed to save performance:', err));
      }
    }
  }

  function replay() {
    for (const p of players) {
      p.results = null;
      p.recentJudgments = [];
      p.score = 0;
      p.combo = 0;
      p.lastJudgment = null;
      p.accuracy = 0;
      p.pitchDetector = null;
      p.scoringEngine = null;
      p.micError = false;
    }
    gameState = 'idle';
    player.destroy();
  }

  function goBack() {
    player.destroy();
    for (const p of activePlayers) {
      p.pitchDetector?.stop();
    }
    goto('/library');
  }

  onDestroy(() => {
    if (scoreTickId) cancelAnimationFrame(scoreTickId);
    for (const p of players) {
      p.pitchDetector?.stop();
    }
    player.destroy();
  });
</script>

<div class="performance-page">
  {#if gameState === 'idle'}
    <div class="idle-screen">
      <GlassCard padding="lg">
        <div class="idle-content">
          <h1 class="idle-title">{data.track.title}</h1>

          {#if !data.hasNotes}
            <p class="idle-warning">No note data available. Import the track from YouTube first.</p>
            <Button variant="secondary" onclick={goBack}>Back to Library</Button>
          {:else}
            <p class="idle-subtitle">Choose instruments and start performing</p>

            <div class="player-slots">
              {#each players as p, i}
                <PlayerSlot
                  playerIndex={i}
                  availableInstruments={data.availableInstruments}
                  {audioDevices}
                  {takenInstruments}
                  selectedInstrument={p.instrument}
                  selectedDeviceId={p.deviceId}
                  noteCount={p.instrument ? data.stemsWithNotes[p.instrument]?.notes.length ?? 0 : 0}
                  onInstrumentChange={(inst) => { players[i]!.instrument = inst; }}
                  onDeviceChange={(devId) => { players[i]!.deviceId = devId; }}
                  removable={playerCount > 1}
                  onRemove={() => removePlayer(i)}
                />
              {/each}
            </div>

            {#if playerCount < data.availableInstruments.length}
              <button class="add-player-btn" onclick={addPlayer}>+ Add Player</button>
            {/if}

            <div class="idle-actions">
              <Button variant="primary" size="lg" disabled={!canStart} onclick={startGame}>
                Start Performance
              </Button>
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
      {#each activePlayers as p, i}
        {@const inst = p.instrument!}
        <div class="player-lane" style:border-color={INSTRUMENT_COLORS[inst]}>
          {#if p.micError}
            <div class="mic-warning">Mic unavailable — scoring disabled</div>
          {/if}
          <div class="lane-header">
            <span class="lane-label" style:color={INSTRUMENT_COLORS[inst]}>
              P{i + 1} — {INSTRUMENT_LABELS[inst]}
            </span>
            <ScoreDisplay
              score={p.score}
              combo={p.combo}
              lastJudgment={p.lastJudgment}
              accuracy={p.accuracy}
            />
          </div>
          <div class="highway-area">
            <NoteHighway
              notes={data.stemsWithNotes[inst]?.notes ?? []}
              currentTime={player.currentTime}
              recentJudgments={p.recentJudgments}
              minPitch={INSTRUMENT_MIDI_RANGES[inst].min}
              maxPitch={INSTRUMENT_MIDI_RANGES[inst].max}
            />
          </div>
        </div>
      {/each}

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

  {#if gameState === 'finished' && activePlayers.some(p => p.results)}
    {#if activePlayers.length === 1 && activePlayers[0]?.results}
      <ResultsScreen
        result={activePlayers[0].results}
        trackTitle={data.track.title}
        trackId={data.track.id}
        playerLabel="P1 — {INSTRUMENT_LABELS[activePlayers[0].instrument!]}"
        accentColor={INSTRUMENT_COLORS[activePlayers[0].instrument!]}
        onReplay={replay}
        onBack={goBack}
      />
    {:else}
      <div class="results-multi-overlay">
        <div class="results-multi-grid">
          {#each activePlayers as p, i}
            {#if p.results}
              <GlassCard padding="lg">
                <div class="result-card">
                  <h3 class="result-player" style:color={INSTRUMENT_COLORS[p.instrument!]}>
                    P{i + 1} — {INSTRUMENT_LABELS[p.instrument!]}
                  </h3>
                  <div class="result-grade" style:color={gradeColor(p.results.accuracy)}>
                    {gradeLetter(p.results.accuracy)}
                  </div>
                  <div class="result-score">{p.results.totalScore.toLocaleString()}</div>
                  <div class="result-stats">
                    <span style:color="#00f5ff">{p.results.perfectCount}P</span>
                    <span style:color="#00ff88">{p.results.greatCount}G</span>
                    <span style:color="#f59e0b">{p.results.goodCount}OK</span>
                    <span style:color="#ff4466">{p.results.missCount}M</span>
                  </div>
                  <div class="result-meta">
                    {p.results.maxCombo}x combo · {p.results.accuracy}%
                  </div>
                </div>
              </GlassCard>
            {/if}
          {/each}
        </div>
        <div class="results-actions">
          <Button variant="primary" onclick={replay}>Play Again</Button>
          <Button variant="secondary" onclick={goBack}>Back to Library</Button>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .performance-page {
    height: 100%;
    background: #0a0a0f;
  }

  .idle-screen {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100%;
    padding: 2rem;
  }

  .idle-content {
    text-align: center;
    max-width: 500px;
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

  .idle-warning {
    color: #f59e0b;
    font-size: 0.875rem;
    margin-bottom: 1rem;
  }

  .player-slots {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 1rem;
    text-align: left;
  }

  .add-player-btn {
    background: none;
    border: 1px dashed rgba(255, 255, 255, 0.15);
    color: #a0a0b0;
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    cursor: pointer;
    font-size: 0.8rem;
    width: 100%;
    margin-bottom: 1.5rem;
    transition: all 150ms ease;
  }

  .add-player-btn:hover {
    border-color: rgba(0, 245, 255, 0.4);
    color: #00f5ff;
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
    min-height: 100%;
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
    height: 100%;
    padding: 0.5rem 1rem;
    gap: 0.5rem;
  }

  .player-lane {
    flex: 1;
    display: flex;
    flex-direction: column;
    border-left: 3px solid;
    padding-left: 0.75rem;
    min-height: 0;
  }

  .lane-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.25rem 0;
  }

  .lane-label {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .highway-area {
    flex: 1;
    min-height: 0;
  }

  .transport-area {
    padding: 0.5rem 0;
    flex-shrink: 0;
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
    padding: 0.25rem 0.75rem;
    border-radius: 0.5rem;
    font-size: 0.7rem;
    text-align: center;
  }

  .results-multi-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(10, 10, 15, 0.85);
    backdrop-filter: blur(8px);
    z-index: 100;
    padding: 2rem;
    gap: 1.5rem;
    overflow-y: auto;
  }

  .results-multi-grid {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    justify-content: center;
  }

  .result-card {
    text-align: center;
    min-width: 180px;
  }

  .result-player {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: 0.5rem;
  }

  .result-grade {
    font-size: 3rem;
    font-weight: 900;
    line-height: 1;
    margin-bottom: 0.25rem;
  }

  .result-score {
    font-family: var(--font-mono, monospace);
    font-size: 1.125rem;
    font-weight: 700;
    margin-bottom: 0.75rem;
  }

  .result-stats {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
    font-family: var(--font-mono, monospace);
    font-size: 0.75rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }

  .result-meta {
    font-size: 0.7rem;
    color: #606070;
  }

  .results-actions {
    display: flex;
    gap: 0.75rem;
  }
</style>
