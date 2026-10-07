<script lang="ts">
  import type { GuitarPerformance } from '@nuit-one/shared';
  import { colors } from '@nuit-one/ui';
  import { onMount } from 'svelte';
  import { createLayout, visibleFretCount } from '$lib/guitar/layout.js';
  import { createPalette } from '$lib/guitar/palette.js';
  import { FretboardPainter } from '$lib/guitar/renderer.js';
  import {
    buildTimeline,
    chordAt,
    describeUpcoming,
    dynamicAt,
    handPositionAt,
    lookAheadSeconds,
    measureBeatAt,
    positionLabel,
    type Timeline,
    upcomingNotes,
  } from '$lib/guitar/timeline.js';

  interface Props {
    /** A `nuit.guitar-performance/1` document: the notes, the instrument twin and the timing. */
    performance: GuitarPerformance;
    /** Position in the piece in seconds, on the performance's own clock. */
    currentTime: number;
    /** Whether that clock is running, so the view can bridge the gaps between time updates. */
    playing: boolean;
    /** Playback speed relative to the original (0.5 to 1). */
    speed?: number;
  }

  const { performance: score, currentTime, playing, speed = 1 }: Props = $props();

  /** The live-region text changes at most this often while playing (it is read aloud). */
  const LIVE_INTERVAL_MS = 1400;
  /** If the clock stops reporting while "playing", stop extrapolating after this long. */
  const MAX_EXTRAPOLATION_MS = 250;

  const timeline = $derived(buildTimeline(score));
  const lookAhead = $derived(lookAheadSeconds(timeline));
  const fretsShown = $derived(visibleFretCount(timeline.notes, timeline.fretCount));
  const beatDots = $derived(Array.from({ length: timeline.beatsPerBar }, (_, i) => i + 1));
  const twinLabel = $derived(
    [
      score.instrument.variant,
      `${Math.round(score.instrument.geometry.scaleLengthMm)} mm scale`,
      `${score.instrument.geometry.fretCount} frets`,
      score.instrument.tuning.name,
    ].join(' · '),
  );

  let stage: HTMLDivElement | undefined = $state();
  let canvas: HTMLCanvasElement | undefined = $state();

  // Readouts: assigned every frame, but Svelte only touches the DOM when a value changes.
  let chord = $state<string | null>(null);
  let measure = $state(0);
  let beat = $state(0);
  let dynamicMark = $state<string | null>(null);
  let position = $state<string | null>(null);
  let nextNotes = $state('');

  onMount(() => {
    const stageEl = stage;
    const canvasEl = canvas;
    const ctx = canvasEl?.getContext('2d');
    if (!stageEl || !canvasEl || !ctx) return;

    const painter = new FretboardPainter({
      palette: createPalette(colors),
      fontFamily: getComputedStyle(stageEl).getPropertyValue('--fb-mono').trim() || 'monospace',
    });

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reducedMotion = motion.matches;
    let configuredFor: { timeline: Timeline; width: number; height: number; dpr: number; frets: number } | null = null;
    let lastKey = '';
    const onMotionChange = (event: MediaQueryListEvent): void => {
      reducedMotion = event.matches;
      lastKey = '';
    };
    motion.addEventListener('change', onMotionChange);

    let width = 0;
    let height = 0;
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box) {
        width = box.width;
        height = box.height;
      }
    });
    observer.observe(stageEl);

    // The clock we are given may update every frame, or only a few times a second. Remember when the
    // value last changed and carry it forward, so motion is smooth either way (and a value that is a
    // frame stale is corrected).
    let anchorTime = Number.NaN;
    let anchorStamp = 0;
    let anchoredPlaying = false;

    let lastNextId = Number.NaN;
    let pendingText = '';
    let hasPending = false;
    let lastLiveStamp = Number.NEGATIVE_INFINITY;

    let raf = 0;
    const frame = (stamp: number): void => {
      raf = requestAnimationFrame(frame);
      if (width < 16 || height < 16) return;

      const reported = Number.isFinite(currentTime) ? currentTime : 0;
      if (reported !== anchorTime || playing !== anchoredPlaying) {
        anchorTime = reported;
        anchorStamp = stamp;
        anchoredPlaying = playing;
      }
      const carried = playing ? (Math.min(stamp - anchorStamp, MAX_EXTRAPOLATION_MS) / 1000) * speed : 0;
      const t = reported + carried;

      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const tl = timeline;
      const frets = fretsShown;
      if (
        !configuredFor ||
        configuredFor.timeline !== tl ||
        configuredFor.width !== width ||
        configuredFor.height !== height ||
        configuredFor.dpr !== dpr ||
        configuredFor.frets !== frets
      ) {
        canvasEl.width = Math.max(1, Math.round(width * dpr));
        canvasEl.height = Math.max(1, Math.round(height * dpr));
        painter.configure(createLayout(score.instrument.geometry, { width, height, visibleFrets: frets }), dpr);
        configuredFor = { timeline: tl, width, height, dpr, frets };
        lastKey = '';
        // A new performance must be announced afresh, even if its next note has the same id.
        lastNextId = Number.NaN;
      }

      const key = `${t}|${reducedMotion}`;
      if (key !== lastKey) {
        painter.paint(ctx, { timeline: tl, t, lookAhead, reducedMotion });
        lastKey = key;
      }

      const bar = measureBeatAt(tl, t);
      measure = bar.measure;
      beat = bar.beat;
      chord = chordAt(tl, t);
      dynamicMark = dynamicAt(tl, t);
      const hand = handPositionAt(tl, t);
      position = hand ? positionLabel(hand.fret) : null;

      // What to announce: describe the next notes whenever the next note changes, but when playing
      // let a screen reader finish before the text moves on.
      const nextId = upcomingNotes(tl, t, lookAhead, 1)[0]?.id ?? -1;
      if (nextId !== lastNextId) {
        lastNextId = nextId;
        pendingText = describeUpcoming(tl, t, lookAhead);
        hasPending = true;
      }
      if (hasPending && (!playing || stamp - lastLiveStamp >= LIVE_INTERVAL_MS)) {
        nextNotes = pendingText;
        hasPending = false;
        lastLiveStamp = stamp;
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      motion.removeEventListener('change', onMotionChange);
    };
  });
</script>

<section
  class="fretboard"
  aria-label="Guitar fretboard"
  style:--fb-base={colors.background.base}
  style:--fb-surface={colors.background.surface}
  style:--fb-cyan={colors.neon.cyan}
  style:--fb-amber={colors.neon.amber}
  style:--fb-magenta={colors.neon.magenta}
  style:--fb-text={colors.text.primary}
  style:--fb-soft={colors.text.secondary}
>
  <dl class="hud">
    <div class="readout readout--chord">
      <dt>Chord</dt>
      <dd class:empty={chord === null}>{chord ?? '–'}</dd>
    </div>
    <div class="readout readout--bar">
      <dt>Bar · beat</dt>
      <dd>
        <span class="sr-only">Bar </span><span class="bar-number">{measure}</span>
        <span class="beat-dots" aria-hidden="true">
          {#each beatDots as n (n)}
            <i class="dot" class:on={n === beat} class:down={n === 1}></i>
          {/each}
        </span>
        <span class="sr-only">, beat </span><span class="beat-number">{beat}</span>
      </dd>
    </div>
    <div class="readout">
      <dt>Dynamic</dt>
      <dd class="dynamic" class:empty={dynamicMark === null}>{dynamicMark ?? '–'}</dd>
    </div>
    <div class="readout">
      <dt>Position</dt>
      <dd class:empty={position === null}>{position ?? '–'}</dd>
    </div>
  </dl>

  <div class="stage" bind:this={stage}>
    <canvas bind:this={canvas} aria-hidden="true"></canvas>
  </div>

  <p class="next" role="status" aria-live="polite" aria-atomic="true">
    <span class="next-label">Next</span>
    <span class="next-text">{nextNotes || '–'}</span>
  </p>
  <p class="twin">{twinLabel}</p>
</section>

<style>
  .fretboard {
    --fb-mono: var(--font-mono, ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, Consolas, monospace);
    display: grid;
    gap: 0.75rem;
    min-width: 0;
    color: var(--fb-text);
  }

  /* Readouts: small instrument-panel cells, label over value. */
  .hud {
    display: flex;
    flex-wrap: wrap;
    gap: 0.625rem;
    margin: 0;
    font-family: var(--fb-mono);
  }

  .readout {
    display: grid;
    gap: 0.3125rem;
    min-width: 5.25rem;
    padding: 0.5rem 0.875rem 0.5625rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
  }

  .readout dt {
    margin: 0;
    font-size: 0.625rem;
    font-weight: 600;
    letter-spacing: 0.16em;
    line-height: 1;
    text-transform: uppercase;
    color: var(--fb-soft);
  }

  .readout dd {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
  }

  .readout--chord {
    min-width: 7rem;
    border-color: color-mix(in srgb, var(--fb-cyan) 28%, transparent);
    background: color-mix(in srgb, var(--fb-cyan) 6%, transparent);
  }

  .readout--chord dd {
    font-size: 2.125rem;
    color: var(--fb-cyan);
    text-shadow: 0 0 22px color-mix(in srgb, var(--fb-cyan) 40%, transparent);
  }

  /* "No chord here", "no mark yet": present but quiet. */
  .readout dd.empty {
    color: var(--fb-soft);
    text-shadow: none;
    opacity: 0.5;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .bar-number {
    min-width: 1.25ch;
  }

  .beat-number {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--fb-soft);
  }

  .beat-dots {
    display: inline-flex;
    gap: 0.3125rem;
  }

  .dot {
    display: block;
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.12);
    transition: background-color 120ms ease;
  }

  .dot.down {
    outline: 1px solid rgba(255, 255, 255, 0.22);
    outline-offset: 1px;
  }

  .dot.on {
    background: var(--fb-cyan);
    box-shadow: 0 0 10px color-mix(in srgb, var(--fb-cyan) 70%, transparent);
    animation: beat-pop 240ms cubic-bezier(0.2, 0.9, 0.3, 1.2);
  }

  .dynamic {
    font-style: italic;
    min-width: 2.5ch;
  }

  @keyframes beat-pop {
    0% {
      transform: scale(1.9);
    }
    100% {
      transform: scale(1);
    }
  }

  .stage {
    position: relative;
    width: 100%;
    height: var(--fretboard-height, clamp(340px, 56vh, 620px));
    overflow: hidden;
    background: var(--fb-base);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 14px;
    box-shadow:
      0 24px 60px rgba(0, 0, 0, 0.5),
      inset 0 0 0 1px rgba(255, 255, 255, 0.02);
  }

  canvas {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
  }

  .next {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
    min-width: 0;
    margin: 0;
    font-family: var(--fb-mono);
    font-size: 0.8125rem;
    line-height: 1.4;
    color: var(--fb-text);
  }

  .next-label {
    flex: none;
    font-size: 0.625rem;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--fb-cyan);
  }

  .next-text {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .twin {
    margin: 0;
    font-family: var(--fb-mono);
    font-size: 0.6875rem;
    letter-spacing: 0.04em;
    color: var(--fb-soft);
    opacity: 0.85;
  }

  @media (max-width: 520px) {
    .hud {
      gap: 0.4375rem;
    }

    .readout {
      flex: 1 1 auto;
      min-width: 0;
      padding: 0.4375rem 0.625rem 0.5rem;
    }

    .beat-dots {
      display: none;
    }

    .readout dd {
      font-size: 1.25rem;
    }

    .readout--chord dd {
      font-size: 1.75rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .dot.on {
      animation: none;
    }
  }
</style>
