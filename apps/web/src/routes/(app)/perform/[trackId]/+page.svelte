<script lang="ts">
  
  import type { HitJudgment, NoteEvent, PerformanceResult, PlayableInstrument } from '@nuit-one/shared';
  import {INSTRUMENT_COLORS,
    INSTRUMENT_FREQUENCY_RANGES,
    INSTRUMENT_LABELS, INSTRUMENT_MIDI_RANGES,
  } from '@nuit-one/shared';
  import { Button, GlassCard } from '@nuit-one/ui';
  import Pusher from 'pusher-js';
  import { onDestroy, onMount } from 'svelte';
import { goto } from '$app/navigation';
  import { createAudienceSender } from '$lib/audience-channel.js';
  import { type AudioInputDevice, getAudioInputDevices } from '$lib/audio/device-manager.js';
  import type { InputSource } from '$lib/audio/input-source.js';
  import { type MidiInputDevice, getMidiInputDevices, isMidiSupported } from '$lib/audio/midi-device-manager.js';
  import { MidiInput } from '$lib/audio/midi-input.js';
  import { PitchDetector } from '$lib/audio/pitch-detector.js';
  import { ScoringEngine } from '$lib/audio/scoring-engine.js';
  import NoteHighway from '$lib/components/NoteHighway.svelte';
  import PlayerSlot from '$lib/components/PlayerSlot.svelte';
  import ResultsScreen from '$lib/components/ResultsScreen.svelte';
  import ScoreDisplay from '$lib/components/ScoreDisplay.svelte';
  import SetlistInterstitial from '$lib/components/SetlistInterstitial.svelte';
  import { icons } from '$lib/icons';
  import { createPlayerStore } from '$lib/stores/player.svelte.js';
  import { getSetlistStore } from '$lib/stores/setlist.svelte.js';
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
    inputType: 'microphone' | 'midi';
    midiDeviceId: string | null;
    inputSource: InputSource | null;
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
      inputType: 'microphone',
      midiDeviceId: null,
      inputSource: null,
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
  const setlist = getSetlistStore();
  const inSetlistMode = $derived(setlist.isActive);

  let gameState = $state<GameState>('idle');
  let countdown = $state(3);
  let scoreTickId: number | null = null;
  let audienceFrameCount = 0;

  let playerCount = $state(1);
  let players = $state<PlayerConfig[]>([createDefaultPlayerConfig()]);
  let audioDevices = $state<AudioInputDevice[]>([]);
  let midiDevices = $state<MidiInputDevice[]>([]);
  let midiSupported = $state(false);

  const activePlayers = $derived(players.filter(p => p.instrument !== null));
  const takenInstruments = $derived(
    players.map(p => p.instrument).filter((i): i is PlayableInstrument => i !== null)
  );
  const canStart = $derived(activePlayers.length > 0);

  let isFullscreen = $state(false);

  // --- Live score broadcasting via Soketi ---
  let performPusher: Pusher | null = null;
  let performChannel: ReturnType<Pusher['subscribe']> | null = null;
  let liveScoreInterval: ReturnType<typeof setInterval> | null = null;

  // --- Audience broadcast channel ---
  let audienceSender: ReturnType<typeof createAudienceSender> | null = null;

  function openAudienceView() {
    window.open(`/audience/${data.track.id}`, 'nuit-audience', 'width=1920,height=1080');
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  $effect(() => {
    function onFullscreenChange() {
      isFullscreen = !!document.fullscreenElement;
    }
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  });

  $effect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (gameState === 'playing' && (e.key === 'f' || e.key === 'F')) {
        toggleFullscreen();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  });

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

  // Load audio devices on mount + restore setlist player configs
  onMount(async () => {
    audienceSender = createAudienceSender(data.track.id);

    try {
      audioDevices = await getAudioInputDevices();
    } catch {
      // Mic permission denied or unavailable — will handle per-player
    }

    // Check MIDI support and load devices
    midiSupported = isMidiSupported();
    if (midiSupported) {
      try {
        midiDevices = await getMidiInputDevices();
      } catch {
        // MIDI access denied — leave midiDevices empty
      }
    }

    // If in setlist mode, restore instrument/device selections from previous track
    if (inSetlistMode) {
      const configs = setlist.getPlayerConfigs();
      if (configs.length > 0) {
        const restored: PlayerConfig[] = configs.map((c) => ({
          ...createDefaultPlayerConfig(),
          instrument: c.instrument,
          deviceId: c.deviceId,
          inputType: c.inputType ?? 'microphone',
          midiDeviceId: c.midiDeviceId ?? null,
        }));
        players = restored;
        playerCount = restored.length;
      }
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

    // Init scoring + input sources per player
    for (const p of activePlayers) {
      const notes = data.stemsWithNotes[p.instrument!]?.notes ?? [];
      p.scoringEngine = new ScoringEngine(notes);

      if (p.inputType === 'midi') {
        p.inputSource = new MidiInput();
      } else if (player.player?.audioContext) {
        const range = INSTRUMENT_FREQUENCY_RANGES[p.instrument!];
        p.inputSource = new PitchDetector(player.player.audioContext, {
          minFrequency: range.min,
          maxFrequency: range.max,
          deviceId: p.deviceId ?? undefined,
        });
      }
    }

    // Broadcast track info and note data to audience view
    audienceSender?.send({ type: 'track', title: data.track.title });
    const instrumentNotes: Record<string, { notes: NoteEvent[]; minPitch: number; maxPitch: number; color: string }> = {};
    for (const p of activePlayers) {
      const inst = p.instrument!;
      const stemData = data.stemsWithNotes[inst];
      if (stemData) {
        instrumentNotes[inst] = {
          notes: stemData.notes,
          minPitch: INSTRUMENT_MIDI_RANGES[inst].min,
          maxPitch: INSTRUMENT_MIDI_RANGES[inst].max,
          color: INSTRUMENT_COLORS[inst],
        };
      }
    }
    audienceSender?.send({ type: 'notes', instruments: instrumentNotes });

    // Countdown
    gameState = 'countdown';
    countdown = 3;
    audienceSender?.send({ type: 'state', gameState: 'countdown', currentTime: 0, duration: 0, countdown: 3 });

    const countdownInterval = setInterval(() => {
      countdown--;
      audienceSender?.send({ type: 'state', gameState: 'countdown', currentTime: 0, duration: 0, countdown });
      if (countdown <= 0) {
        clearInterval(countdownInterval);
        beginPlayback();
      }
    }, 1000);
  }

  async function beginPlayback() {
    gameState = 'playing';
    player.play();
    audienceFrameCount = 0;

    // Start live score broadcasting via Soketi
    if (data.workspaceId && data.soketiAppKey) {
      try {
        performPusher = new Pusher(data.soketiAppKey, {
          wsHost: data.soketiHost ?? 'localhost',
          wsPort: data.soketiPort ?? 6001,
          wssPort: data.soketiPort ?? 6001,
          forceTLS: false,
          enabledTransports: ['ws', 'wss'],
          authEndpoint: '/api/pusher/auth',
          cluster: 'mt1',
        });
        performChannel = performPusher.subscribe(`private-workspace-${data.workspaceId}`);
      } catch {
        // Non-fatal: live score broadcasting is optional
      }

      liveScoreInterval = setInterval(() => {
        if (gameState !== 'playing' || !performChannel) return;
        try {
          performChannel.trigger('client-live-score', {
            userId: data.userId,
            trackId: data.track.id,
            score: activePlayers[0]?.score ?? 0,
            accuracy: activePlayers[0]?.accuracy ?? 0,
            combo: activePlayers[0]?.combo ?? 0,
            timestamp: Date.now(),
          });
        } catch {
          // Ignore broadcast failures
        }
      }, 3000);
    }

    // Start input sources for each player
    for (const p of activePlayers) {
      try {
        if (p.inputSource instanceof MidiInput) {
          await p.inputSource.start(p.midiDeviceId ?? undefined);
        } else if (p.inputSource) {
          await p.inputSource.start();
        }
      } catch (err) {
        console.warn('Input source unavailable:', err);
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

      if (p.inputSource?.running && p.inputSource.currentMidiNote > 0) {
        const judgment = p.scoringEngine.evaluate(time, p.inputSource.currentMidiNote, p.inputSource.currentAmplitude);
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

    // Broadcast to audience every 3rd frame
    if (audienceFrameCount % 3 === 0) {
      audienceSender?.send({
        type: 'state',
        gameState: 'playing',
        currentTime: time,
        duration: player.duration,
      });
      audienceSender?.send({
        type: 'scores',
        players: activePlayers.map((p, i) => ({
          label: `P${i + 1}`,
          instrument: INSTRUMENT_LABELS[p.instrument!],
          color: INSTRUMENT_COLORS[p.instrument!],
          score: p.score,
          combo: p.combo,
          accuracy: p.accuracy,
          lastJudgment: p.lastJudgment,
        })),
      });
    }
    audienceFrameCount++;

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
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});

    if (scoreTickId) cancelAnimationFrame(scoreTickId);

    // Clean up live score broadcasting
    if (liveScoreInterval) clearInterval(liveScoreInterval);
    liveScoreInterval = null;
    performChannel?.unsubscribe();
    performPusher?.disconnect();
    performChannel = null;
    performPusher = null;

    // Finalize each player
    for (const p of activePlayers) {
      p.inputSource?.stop();

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

    // Broadcast results to audience view
    audienceSender?.send({
      type: 'results',
      players: activePlayers
        .filter((p) => p.results !== null)
        .map((p, i) => ({
          label: `P${i + 1}`,
          instrument: INSTRUMENT_LABELS[p.instrument!],
          color: INSTRUMENT_COLORS[p.instrument!],
          results: p.results!,
        })),
    });

    // Record results for setlist mode
    if (inSetlistMode) {
      const resultsMap: Record<string, PerformanceResult> = {};
      for (const p of activePlayers) {
        if (p.results && p.instrument) {
          resultsMap[p.instrument] = p.results;
        }
      }
      setlist.recordResult(resultsMap);

      // Save player configs so they persist to the next track
      setlist.setPlayerConfigs(
        players
          .filter((p) => p.instrument !== null)
          .map((p) => ({
            instrument: p.instrument,
            deviceId: p.deviceId,
            inputType: p.inputType,
            midiDeviceId: p.midiDeviceId,
          })),
      );
    }
  }

  let reimporting = $state(false);

  async function reimport() {
    if (!data.reimportUrl || reimporting) return;
    reimporting = true;
    try {
      const res = await fetch('/api/import/youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: data.reimportUrl }),
      });
      if (res.ok) {
        goto('/library');
      } else {
        reimporting = false;
      }
    } catch {
      reimporting = false;
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
      p.inputSource = null;
      p.scoringEngine = null;
      p.micError = false;
    }
    gameState = 'idle';
    player.destroy();
  }

  function goBack() {
    player.destroy();
    for (const p of activePlayers) {
      p.inputSource?.stop();
    }
    goto('/library');
  }

  function advanceSetlist() {
    // Cleanup current track
    player.destroy();
    for (const p of activePlayers) {
      p.inputSource?.stop();
    }
    if (scoreTickId) cancelAnimationFrame(scoreTickId);
    scoreTickId = null;

    setlist.advance();
    const next = setlist.currentTrack;
    if (next) {
      goto(`/perform/${next.trackId}?setlist=true`);
    }
  }

  function finishSetlist() {
    // Cleanup current track
    player.destroy();
    for (const p of activePlayers) {
      p.inputSource?.stop();
    }
    if (scoreTickId) cancelAnimationFrame(scoreTickId);
    scoreTickId = null;

    goto('/setlist/results');
  }

  onDestroy(() => {
    if (scoreTickId) cancelAnimationFrame(scoreTickId);
    if (liveScoreInterval) clearInterval(liveScoreInterval);
    performChannel?.unsubscribe();
    performPusher?.disconnect();
    for (const p of players) {
      p.inputSource?.stop();
    }
    player.destroy();
    audienceSender?.close();
  });
</script>

<div class="performance-page">
  {#if data.expired}
    <div class="idle-screen">
      <GlassCard padding="lg">
        <div class="expired-content">
          <h2 class="expired-title">Track Expired</h2>
          <p class="expired-text">
            This track's audio has been archived to save storage.
            Re-import it from the original source to play again.
          </p>
          <div class="expired-actions">
            {#if data.reimportUrl}
              <Button variant="primary" disabled={reimporting} onclick={reimport}>
                {reimporting ? 'Re-importing...' : 'Re-import Now'}
              </Button>
            {/if}
            <Button variant="secondary" onclick={goBack}>Back to Library</Button>
          </div>
        </div>
      </GlassCard>
    </div>
  {:else if gameState === 'idle'}
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
                  inputType={p.inputType}
                  {midiDevices}
                  selectedMidiDeviceId={p.midiDeviceId}
                  {midiSupported}
                  onInputTypeChange={(type) => { players[i]!.inputType = type; }}
                  onMidiDeviceChange={(devId) => { players[i]!.midiDeviceId = devId; }}
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
              <button class="audience-btn" onclick={openAudienceView}>
                Open Audience View
              </button>
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
    <div class="playing-layout" class:fullscreen={isFullscreen}>
      {#each activePlayers as p, i}
        {@const inst = p.instrument!}
        <div class="player-lane" style:border-color={INSTRUMENT_COLORS[inst]}>
          {#if p.micError}
            <div class="mic-warning">Input unavailable — scoring disabled</div>
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
              combo={p.combo}
            />
          </div>
        </div>
      {/each}

      <div class="transport-area">
        <div class="transport-info">
          <span class="time-display">
            {formatTime(player.currentTime)} / {formatTime(player.duration)}
            {#if inSetlistMode}
              <span class="setlist-indicator">Track {setlist.currentIndex + 1} / {setlist.totalTracks}</span>
            {/if}
          </span>
          <div class="transport-actions">
            <Button variant="ghost" size="sm" onclick={endGame}>End Early</Button>
            <button
              class="fullscreen-btn"
              onclick={toggleFullscreen}
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round" width="20" height="20">
                <path d={isFullscreen ? icons.exitFullscreen : icons.fullscreen}/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}

  {#if gameState === 'finished' && activePlayers.some(p => p.results)}
    {#if inSetlistMode}
      {@const bestResult = activePlayers.reduce<PerformanceResult | null>((best, p) => {
        if (!p.results) return best;
        if (!best || p.results.accuracy > best.accuracy) return p.results;
        return best;
      }, null)}
      {#if bestResult}
        <SetlistInterstitial
          trackTitle={data.track.title}
          trackNumber={setlist.currentIndex + 1}
          totalTracks={setlist.totalTracks}
          results={bestResult}
          nextTrackTitle={setlist.nextTrack?.title ?? null}
          isLastTrack={setlist.isLastTrack}
          onNext={advanceSetlist}
          onFinish={finishSetlist}
        />
      {/if}
    {:else if activePlayers.length === 1 && activePlayers[0]?.results}
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

  .expired-content {
    text-align: center;
    max-width: 400px;
    margin: 0 auto;
  }

  .expired-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: #f59e0b;
    margin-bottom: 0.5rem;
  }

  .expired-text {
    color: #a0a0b0;
    font-size: 0.875rem;
    margin-bottom: 1.5rem;
    line-height: 1.5;
  }

  .expired-actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
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

  .audience-btn {
    background: none;
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #a0a0b0;
    padding: 0.5rem 1.25rem;
    border-radius: 0.5rem;
    cursor: pointer;
    font-size: 0.8rem;
    transition: all 150ms ease;
  }

  .audience-btn:hover {
    border-color: rgba(0, 245, 255, 0.4);
    color: #00f5ff;
    background: rgba(0, 245, 255, 0.05);
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

  .playing-layout.fullscreen {
    padding: 0;
    gap: 0;
  }

  .playing-layout.fullscreen .player-lane {
    border-left: none;
    padding-left: 0;
  }

  .playing-layout.fullscreen .lane-header {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    z-index: 10;
  }

  .playing-layout.fullscreen .lane-label {
    display: none;
  }

  .playing-layout.fullscreen .highway-area {
    position: relative;
  }

  .playing-layout.fullscreen .transport-area {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: linear-gradient(transparent, rgba(10, 10, 15, 0.8));
    padding: 1rem;
    z-index: 20;
    opacity: 0;
    transition: opacity 200ms ease;
  }

  .playing-layout.fullscreen .transport-area:hover,
  .playing-layout.fullscreen .transport-area:focus-within {
    opacity: 1;
  }

  .fullscreen-btn {
    background: none;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    color: #a0a0b0;
    padding: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 150ms ease;
  }

  .fullscreen-btn:hover {
    color: #00f5ff;
    border-color: rgba(0, 245, 255, 0.4);
  }

  .transport-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .setlist-indicator {
    margin-left: 0.75rem;
    font-size: 0.7rem;
    font-weight: 600;
    color: #00f5ff;
    background: rgba(0, 245, 255, 0.1);
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
  }
</style>
