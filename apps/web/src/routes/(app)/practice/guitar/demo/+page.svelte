<script lang="ts">
  import { colors } from '@nuit-one/ui';
  import { onDestroy } from 'svelte';
  import { getAudioContext } from '$lib/audio/audio-context.js';
  import FretboardHighway from '$lib/components/guitar/FretboardHighway.svelte';
  import GuitarTransport from '$lib/components/guitar/GuitarTransport.svelte';
  import demo from '$lib/data/guitar-demo-performance.json';
  import { GuitarSynth } from '$lib/guitar/synth.js';
  import { isGuitarPerformance } from '$lib/guitar/timeline.js';

  const SPEEDS = [0.5, 0.75, 1] as const;
  /** Let the last chord ring out before the transport stops. */
  const END_TAIL_SECONDS = 1.4;

  const score = isGuitarPerformance(demo) ? demo : null;
  const duration = score ? Math.max(score.source.durationSec ?? 0, ...score.notes.map((n) => n.offset)) : 0;

  let time = $state(0);
  let playing = $state(false);
  let speed = $state<number>(1);
  /** The time under the slider thumb while it is dragged; null otherwise. */
  let scrubTime = $state<number | null>(null);

  const shownTime = $derived(scrubTime ?? time);

  let synth: GuitarSynth | null = null;
  let raf = 0;

  function startSynth(from: number): void {
    if (!score) return;
    synth ??= new GuitarSynth(getAudioContext());
    synth.start(score.notes, from, speed);
  }

  /** The synth's audio clock is the page's clock: the highway follows what you hear. */
  function tick(): void {
    const position = synth?.position();
    if (position === null || position === undefined) return;
    if (position >= duration + END_TAIL_SECONDS) {
      synth?.stop();
      playing = false;
      time = 0;
      return;
    }
    time = position;
    raf = requestAnimationFrame(tick);
  }

  function play(): void {
    if (!score) return;
    if (time >= duration - 0.05) time = 0;
    startSynth(time);
    playing = true;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  }

  function pause(): void {
    cancelAnimationFrame(raf);
    time = Math.min(synth?.position() ?? time, duration);
    synth?.stop();
    playing = false;
  }

  function toggle(): void {
    if (playing) pause();
    else play();
  }

  function seek(seconds: number): void {
    time = Math.min(Math.max(seconds, 0), duration);
    if (playing) startSynth(time);
  }

  function changeSpeed(next: number): void {
    const now = playing ? Math.min(synth?.position() ?? time, duration) : time;
    speed = next;
    time = now;
    if (playing) startSynth(now);
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.code !== 'Space' || event.defaultPrevented) return;
    const target = event.target;
    if (target instanceof HTMLElement && target.closest('input, button, select, textarea, a, [contenteditable="true"]')) return;
    event.preventDefault();
    toggle();
  }

  // `onDestroy` also runs when the page is rendered on the server, where there is no animation frame.
  onDestroy(() => {
    if (raf) cancelAnimationFrame(raf);
    synth?.dispose();
  });
</script>

<svelte:head>
  <title>Guitar karaoke demo · Nuit One</title>
</svelte:head>

<svelte:window onkeydown={onKeydown} />

<div class="practice" style:--pg-cyan={colors.neon.cyan} style:--pg-text={colors.text.primary} style:--pg-soft={colors.text.secondary}>
  <header class="intro">
    <p class="eyebrow">Guitar karaoke · demo</p>
    <h1>{score?.source.title ?? 'Guitar karaoke demo'}</h1>
    <p class="blurb">An original synthetic étude, generated for Nuit One: not a recording of anyone.</p>
  </header>

  {#if score}
    <FretboardHighway performance={score} currentTime={shownTime} {playing} {speed} />
    <GuitarTransport
      {playing}
      time={Math.min(shownTime, duration)}
      {duration}
      {speed}
      speeds={SPEEDS}
      onToggle={toggle}
      onRestart={() => seek(0)}
      onSeek={seek}
      onScrub={(seconds) => (scrubTime = seconds)}
      onSpeed={changeSpeed}
    />
  {:else}
    <p class="blurb">The demo piece could not be read.</p>
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
  }

  .blurb {
    margin: 0;
    font-size: 0.875rem;
    line-height: 1.5;
    color: var(--pg-soft);
  }

  @media (max-width: 560px) {
    .practice {
      padding: 1rem 0.75rem 2rem;
    }
  }
</style>
