<script lang="ts">
  import type { GuitarPerformance } from '@nuit-one/shared';
  import { Button, colors, GlassCard } from '@nuit-one/ui';
  import { onDestroy, untrack } from 'svelte';
  import FretboardHighway from '$lib/components/guitar/FretboardHighway.svelte';
  import GuitarTransport from '$lib/components/guitar/GuitarTransport.svelte';
  import { fetchGuitarPerformance, fetchJobStatus, type JobPhase, jobLabel, startGuitarIntake } from '$lib/guitar/api.js';
  import { createPlayerStore } from '$lib/stores/player.svelte.js';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  type Phase = 'loading' | 'failed' | 'unavailable' | 'empty' | 'transcribing' | 'ready';

  const POLL_MS = 2000;

  let phase = $state<Phase>('loading');
  /** The transcription: large and never edited, so it is not made deeply reactive. */
  let score = $state.raw<GuitarPerformance | null>(null);
  let message = $state('');

  let jobId = $state<string | null>(null);
  let jobStatus = $state<JobPhase>('queued');
  let jobProgress = $state(0);
  let starting = $state(false);

  async function load(): Promise<void> {
    phase = 'loading';
    message = '';
    try {
      const lookup = await fetchGuitarPerformance(data.track.id);
      if (lookup.performance) {
        // a stored transcription plays even where this server cannot run new intakes
        score = lookup.performance;
        phase = 'ready';
      } else if (!lookup.available) {
        phase = 'unavailable';
      } else {
        phase = 'empty';
      }
    } catch (err) {
      message = err instanceof Error ? err.message : 'Something went wrong.';
      phase = 'failed';
    }
  }

  // Look the transcription up when the page opens, and again if it is reused for another track.
  $effect(() => {
    void data.track.id;
    if (data.expired) return;
    untrack(() => {
      score = null;
      void load();
    });
  });

  async function transcribe(): Promise<void> {
    if (starting) return;
    starting = true;
    message = '';
    const started = await startGuitarIntake(data.track.id);
    starting = false;
    if (!started.ok) {
      message = started.message;
      if (started.unavailable) phase = 'unavailable';
      return;
    }
    jobId = started.jobId;
    jobStatus = 'queued';
    jobProgress = 0;
    phase = 'transcribing';
  }

  // While a job runs, poll it; when it completes, fetch the result.
  $effect(() => {
    if (phase !== 'transcribing' || jobId === null) return;
    const id = jobId;
    let stopped = false;
    const poll = async (): Promise<void> => {
      const status = await fetchJobStatus(id);
      if (stopped || !status) return;
      jobStatus = status.status;
      jobProgress = status.progress;
      if (status.status === 'complete') {
        stopped = true;
        await load();
        if (phase === 'empty') message = 'The transcription finished, but no guitar part was found in this track.';
      } else if (status.status === 'error') {
        stopped = true;
        message = status.error ?? 'The transcription failed.';
        phase = 'empty';
      }
    };
    const timer = setInterval(() => void poll(), POLL_MS);
    void poll();
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  });

  // The track's own audio is the clock. It goes through the existing player (the audio proxy does not
  // serve byte ranges, so a decoded buffer is the reliable way to seek on every browser).
  const player = createPlayerStore();
  let audio = $state<'idle' | 'loading' | 'ready' | 'failed'>('idle');
  let audioAttempt = $state(0);
  /** The time under the slider thumb while it is dragged; null otherwise. */
  let scrubTime = $state<number | null>(null);

  $effect(() => {
    const url = data.audioUrl;
    void audioAttempt;
    if (phase !== 'ready' || !url) return;
    let cancelled = false;
    audio = 'loading';
    untrack(() => player.loadStems({ mix: url }))
      .then(() => {
        if (!cancelled) audio = 'ready';
      })
      .catch(() => {
        if (!cancelled) audio = 'failed';
      });
    return () => {
      cancelled = true;
      player.destroy();
    };
  });

  const shownTime = $derived(scrubTime ?? player.currentTime);
  const provenance = $derived.by(() => {
    if (!score) return '';
    const { engine, quality } = score;
    const fingered = quality.notesFingered === undefined ? '' : `, ${quality.notesFingered} with a fingering`;
    return `Transcribed by ${engine.name} ${engine.version}: ${quality.notesTotal} notes${fingered}.`;
  });
  const audioNote = $derived(
    audio === 'loading' ? 'Loading the track audio…' : audio === 'failed' ? 'The track audio could not be loaded.' : '',
  );

  function onKeydown(event: KeyboardEvent): void {
    if (event.code !== 'Space' || event.defaultPrevented || phase !== 'ready' || audio !== 'ready') return;
    const target = event.target;
    if (target instanceof HTMLElement && target.closest('input, button, select, textarea, a, [contenteditable="true"]')) return;
    event.preventDefault();
    player.togglePlayback();
  }

  onDestroy(() => player.destroy());
</script>

<svelte:head>
  <title>Guitar karaoke · {data.track.title} · Nuit One</title>
</svelte:head>

<svelte:window onkeydown={onKeydown} />

<div class="practice" style:--pg-cyan={colors.neon.cyan} style:--pg-text={colors.text.primary} style:--pg-soft={colors.text.secondary} style:--pg-amber={colors.neon.amber}>
  <header class="intro">
    <a class="back" href="/tracks/{data.track.id}">&larr; {data.track.title}</a>
    <p class="eyebrow">Guitar karaoke</p>
    <h1>{score?.source.title ?? data.track.title}</h1>
  </header>

  {#if data.expired}
    <div class="state">
      <GlassCard padding="lg">
        <h2>This track's audio has been archived</h2>
        <p>Re-import the track from its original source to practise with it again.</p>
        <p><a class="link" href="/library">Back to the library</a></p>
      </GlassCard>
    </div>
  {:else if phase === 'loading'}
    <div class="state" role="status" aria-live="polite">
      <GlassCard padding="lg">
        <p class="loading">Looking for the guitar transcription…</p>
        <div class="bar indeterminate" aria-hidden="true"><div class="fill"></div></div>
      </GlassCard>
    </div>
  {:else if phase === 'failed'}
    <div class="state">
      <GlassCard padding="lg">
        <h2>Couldn't load the guitar transcription</h2>
        <p>{message}</p>
        <Button variant="secondary" onclick={() => void load()}>Try again</Button>
      </GlassCard>
    </div>
  {:else if phase === 'unavailable'}
    <div class="state">
      <GlassCard padding="lg">
        <h2>Guitar intake isn't enabled on this server</h2>
        <p>
          Transcribing a guitar part needs an optional engine that isn't installed here. Everything else in Nuit One
          works as usual.
        </p>
        {#if message}<p class="detail">{message}</p>{/if}
        <p><a class="link" href="/practice/guitar/demo">Try the demo piece instead</a></p>
      </GlassCard>
    </div>
  {:else if phase === 'empty'}
    <div class="state">
      <GlassCard padding="lg">
        <h2>No guitar transcription yet</h2>
        <p>
          Nuit One can listen to this track and work out where each note is played: the string, the fret and the
          finger. It takes a few minutes.
        </p>
        {#if message}<p class="problem" role="alert">{message}</p>{/if}
        <Button variant="primary" disabled={starting} onclick={() => void transcribe()}>
          {starting ? 'Starting…' : 'Transcribe guitar part'}
        </Button>
      </GlassCard>
    </div>
  {:else if phase === 'transcribing'}
    <div class="state">
      <GlassCard padding="lg">
        <h2>Transcribing the guitar part</h2>
        <div
          class="bar"
          role="progressbar"
          aria-label="Guitar transcription progress"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={Math.round(jobProgress)}
        >
          <div class="fill" style:width="{jobProgress}%"></div>
        </div>
        <p class="phase" role="status">{jobLabel(jobStatus)}…</p>
      </GlassCard>
    </div>
  {:else if score}
    <FretboardHighway performance={score} currentTime={shownTime} playing={player.isPlaying} speed={1} />
    <GuitarTransport
      playing={player.isPlaying}
      time={shownTime}
      duration={player.duration}
      disabled={audio !== 'ready'}
      note={audioNote}
      onToggle={() => player.togglePlayback()}
      onRestart={() => player.seek(0)}
      onSeek={(seconds) => player.seek(seconds)}
      onScrub={(seconds) => (scrubTime = seconds)}
    />
    {#if audio === 'failed'}
      <div class="retry"><Button variant="secondary" onclick={() => audioAttempt++}>Try loading the audio again</Button></div>
    {/if}

    <footer class="provenance">
      <p>{provenance}</p>
      {#if score.quality.warnings.length > 0}
        <details>
          <summary>{score.quality.warnings.length} {score.quality.warnings.length === 1 ? 'warning' : 'warnings'} from the engine</summary>
          <ul>
            {#each score.quality.warnings as warning (warning)}
              <li>{warning}</li>
            {/each}
          </ul>
        </details>
      {/if}
    </footer>
  {/if}
</div>

<style>
  .practice {
    display: grid;
    gap: 1rem;
    max-width: 1240px;
    margin: 0 auto;
    padding: 1.5rem 1.5rem 2.5rem;
    color: var(--pg-text);
  }

  .intro {
    display: grid;
    gap: 0.375rem;
  }

  .back {
    justify-self: start;
    font-size: 0.8125rem;
    color: var(--pg-soft);
    text-decoration: none;
  }

  .back:hover {
    color: var(--pg-text);
  }

  .back:focus-visible,
  .link:focus-visible {
    outline: 2px solid var(--pg-cyan);
    outline-offset: 3px;
    border-radius: 4px;
  }

  .eyebrow {
    margin: 0;
    font-family: var(--font-mono, ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, Consolas, monospace);
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--pg-cyan);
  }

  h1 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1.2;
    overflow-wrap: anywhere;
  }

  /* One calm card for every state that is not the fretboard. */
  .state {
    display: grid;
    justify-items: center;
    padding: 2rem 0;
  }

  .state :global(.nuit-glass-card) {
    display: grid;
    gap: 0.75rem;
    justify-items: start;
    width: min(100%, 34rem);
  }

  h2 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
  }

  .state p {
    margin: 0;
    font-size: 0.875rem;
    line-height: 1.55;
    color: var(--pg-soft);
  }

  .state .problem {
    color: var(--pg-amber);
  }

  .state .detail {
    font-size: 0.8125rem;
  }

  .loading {
    color: var(--pg-text);
  }

  .link {
    color: var(--pg-cyan);
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .bar {
    width: 100%;
    height: 4px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
  }

  .fill {
    height: 100%;
    background: var(--pg-cyan);
    border-radius: 2px;
    box-shadow: 0 0 10px color-mix(in srgb, var(--pg-cyan) 50%, transparent);
    transition: width 300ms ease;
  }

  .bar.indeterminate .fill {
    width: 40%;
    animation: slide 1.5s ease-in-out infinite;
  }

  @keyframes slide {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(260%);
    }
  }

  .state .phase {
    font-family: var(--font-mono, ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, Consolas, monospace);
    font-size: 0.8125rem;
  }

  .retry {
    display: flex;
    justify-content: flex-start;
  }

  .provenance {
    display: grid;
    gap: 0.5rem;
    font-size: 0.75rem;
    line-height: 1.5;
    color: var(--pg-soft);
  }

  .provenance p {
    margin: 0;
  }

  .provenance summary {
    cursor: pointer;
  }

  .provenance ul {
    margin: 0.375rem 0 0;
    padding-left: 1.125rem;
    list-style: disc;
  }

  @media (max-width: 560px) {
    .practice {
      padding: 1rem 0.75rem 2rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .bar.indeterminate .fill {
      width: 100%;
      animation: none;
      opacity: 0.5;
    }
  }
</style>
