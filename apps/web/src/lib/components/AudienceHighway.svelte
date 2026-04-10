<script lang="ts">
  import type { NoteEvent } from '@nuit-one/shared';
  import { onDestroy, onMount } from 'svelte';

  interface InstrumentData {
    notes: NoteEvent[];
    minPitch: number;
    maxPitch: number;
    color: string;
  }

  interface Props {
    instruments: Record<string, InstrumentData>;
    currentTime: number;
    duration: number;
  }

  const { instruments, currentTime, duration }: Props = $props();

  let canvas: HTMLCanvasElement;
  let rafId: number;

  const LOOK_AHEAD = 6;
  const BG_COLOR = '#0a0a0f';
  const GRID_COLOR = 'rgba(255, 255, 255, 0.03)';

  /** Compute combined pitch range across all instruments */
  const pitchRange = $derived.by(() => {
    const entries = Object.values(instruments);
    if (entries.length === 0) return { min: 28, max: 72 };
    let min = Infinity;
    let max = -Infinity;
    for (const inst of entries) {
      if (inst.minPitch < min) min = inst.minPitch;
      if (inst.maxPitch > max) max = inst.maxPitch;
    }
    return { min, max };
  });

  function pitchToY(pitch: number, height: number): number {
    const range = pitchRange.max - pitchRange.min;
    if (range <= 0) return height / 2;
    const normalized = (pitch - pitchRange.min) / range;
    return height * (1 - normalized);
  }

  function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return { r: 139, g: 92, b: 246 };
    return {
      r: parseInt(result[1]!, 16),
      g: parseInt(result[2]!, 16),
      b: parseInt(result[3]!, 16),
    };
  }

  function draw() {
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

    // Clear background
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // Subtle edge gradients
    const edgeGradientLeft = ctx.createLinearGradient(0, 0, w * 0.08, 0);
    edgeGradientLeft.addColorStop(0, 'rgba(0, 245, 255, 0.03)');
    edgeGradientLeft.addColorStop(1, 'transparent');
    ctx.fillStyle = edgeGradientLeft;
    ctx.fillRect(0, 0, w * 0.08, h);

    const edgeGradientRight = ctx.createLinearGradient(w * 0.92, 0, w, 0);
    edgeGradientRight.addColorStop(0, 'transparent');
    edgeGradientRight.addColorStop(1, 'rgba(0, 245, 255, 0.03)');
    ctx.fillStyle = edgeGradientRight;
    ctx.fillRect(w * 0.92, 0, w * 0.08, h);

    // Vertical grid lines (one per second of look-ahead)
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    const pixelsPerSecond = w / LOOK_AHEAD;
    for (let sec = 1; sec <= LOOK_AHEAD; sec++) {
      const x = sec * pixelsPerSecond;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    // Horizontal grid lines for octaves
    const range = pitchRange.max - pitchRange.min;
    if (range > 0) {
      for (let midi = pitchRange.min; midi <= pitchRange.max; midi += 12) {
        const y = pitchToY(midi, h);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
    }

    // Draw notes for each instrument
    const windowStart = currentTime - 1;
    const windowEnd = currentTime + LOOK_AHEAD;
    const noteH = Math.max((h / Math.max(range, 1)) * 0.7, 5);

    for (const [, instData] of Object.entries(instruments)) {
      const { r, g, b } = hexToRgb(instData.color);

      for (const note of instData.notes) {
        const noteEnd = note.startTime + note.duration;

        // Skip notes outside visible window
        if (noteEnd < windowStart || note.startTime > windowEnd) continue;

        // Notes scroll right-to-left: x = 0 is currentTime, positive x is future
        const x = (note.startTime - currentTime) * pixelsPerSecond;
        const noteW = Math.max(note.duration * pixelsPerSecond, 3);
        const y = pitchToY(note.pitch, h);

        // Past notes fade out
        const isPast = noteEnd < currentTime;
        if (isPast) {
          ctx.globalAlpha = 0.15;
        } else if (note.startTime <= currentTime) {
          // Currently active note: full brightness with glow
          ctx.globalAlpha = 1.0;
        } else {
          ctx.globalAlpha = 0.75;
        }

        ctx.fillStyle = instData.color;

        // Rounded rectangle
        const radius = 3;
        ctx.beginPath();
        ctx.roundRect(x, y - noteH / 2, noteW, noteH, radius);
        ctx.fill();

        // Glow for active/upcoming notes
        if (!isPast) {
          ctx.shadowColor = instData.color;
          ctx.shadowBlur = note.startTime <= currentTime ? 14 : 6;
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        ctx.globalAlpha = 1;
      }
    }

    // Playhead line (left edge, subtle)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, h);
    ctx.stroke();

    rafId = requestAnimationFrame(draw);
  }

  onMount(() => {
    rafId = requestAnimationFrame(draw);
  });

  onDestroy(() => {
    if (rafId) cancelAnimationFrame(rafId);
  });
</script>

<div class="audience-highway-container">
  <canvas bind:this={canvas} class="audience-highway-canvas"></canvas>
</div>

<style>
  .audience-highway-container {
    width: 100%;
    height: 100%;
    min-height: 200px;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.04);
    background: #0a0a0f;
  }

  .audience-highway-canvas {
    width: 100%;
    height: 100%;
    display: block;
  }
</style>
