<script lang="ts">
  import type { ChordEvent } from '@nuit-one/shared';

  interface Props {
    chords: ChordEvent[];
    currentTime: number;
    duration: number;
    compact?: boolean;
  }

  let { chords, currentTime, duration, compact = false }: Props = $props();

  let canvas: HTMLCanvasElement | undefined = $state();

  const COLORS = {
    bg: '#12121a',
    chord: '#a0a0b0',
    active: '#00f5ff',
    activeBg: 'rgba(0, 245, 255, 0.12)',
    line: 'rgba(240, 240, 245, 0.06)',
    text: '#f0f0f5',
  };

  let currentChord = $derived(
    chords.find((c) => currentTime >= c.time && currentTime < c.time + c.duration)
  );

  $effect(() => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;

    ctx.clearRect(0, 0, w, h);

    if (chords.length === 0 || duration <= 0) return;

    const pxPerSecond = w / Math.min(duration, 30); // Show ~30 seconds window
    const scrollOffset = Math.max(0, currentTime - 10) * pxPerSecond;

    for (const chord of chords) {
      const x = chord.time * pxPerSecond - scrollOffset;
      const cw = chord.duration * pxPerSecond;

      if (x + cw < 0 || x > w) continue;

      const isActive = currentTime >= chord.time && currentTime < chord.time + chord.duration;

      // Background
      ctx.fillStyle = isActive ? COLORS.activeBg : 'transparent';
      ctx.fillRect(x, 0, cw, h);

      // Border
      ctx.strokeStyle = isActive ? COLORS.active : COLORS.line;
      ctx.lineWidth = isActive ? 2 : 1;
      ctx.strokeRect(x, 0, cw, h);

      // Label
      ctx.fillStyle = isActive ? COLORS.active : COLORS.chord;
      ctx.font = isActive
        ? `bold ${compact ? 12 : 16}px Inter, sans-serif`
        : `${compact ? 11 : 14}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(chord.label, x + cw / 2, h / 2);
    }

    // Playhead
    const playheadX = currentTime * pxPerSecond - scrollOffset;
    if (playheadX >= 0 && playheadX <= w) {
      ctx.strokeStyle = COLORS.active;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, h);
      ctx.stroke();
    }
  });
</script>

<div class="chord-chart" class:compact>
  {#if compact && currentChord}
    <span class="current-label">{currentChord.label}</span>
  {/if}
  <canvas bind:this={canvas} class="chart-canvas"></canvas>
</div>

<style>
  .chord-chart {
    position: relative;
    width: 100%;
    height: 64px;
    background: rgba(18, 18, 26, 0.6);
    border-radius: 8px;
    overflow: hidden;
  }

  .compact {
    height: 40px;
  }

  .chart-canvas {
    width: 100%;
    height: 100%;
  }

  .current-label {
    position: absolute;
    top: 2px;
    right: 8px;
    font-size: 11px;
    font-weight: 700;
    color: #00f5ff;
    z-index: 1;
  }
</style>
