<script lang="ts">
  
  import type { HitJudgment, NoteEvent } from '@nuit-one/shared';
import { onDestroy, onMount } from 'svelte';
  import { midiToNoteName } from '$lib/audio/pitch-detector.js';

  interface Props {
    notes: NoteEvent[];
    currentTime: number;
    /** How many seconds of notes to show ahead */
    lookAhead?: number;
    /** Recently judged notes for visual feedback */
    recentJudgments?: Array<{ noteIndex: number; judgment: HitJudgment }>;
    /** Minimum MIDI pitch to display (default: 28, bass E1) */
    minPitch?: number;
    /** Maximum MIDI pitch to display (default: 72, C5) */
    maxPitch?: number;
  }

  const { notes, currentTime, lookAhead = 4, recentJudgments = [],
          minPitch = 28, maxPitch = 72 }: Props = $props();

  let canvas: HTMLCanvasElement;
  let rafId: number;

  const PITCH_RANGE = $derived(maxPitch - minPitch);

  const COLORS = {
    perfect: '#00f5ff',
    great: '#00ff88',
    good: '#f59e0b',
    miss: '#ff4466',
    note: '#8b5cf6',
    hitLine: '#00f5ff',
    background: '#0a0a0f',
    grid: 'rgba(255, 255, 255, 0.04)',
  };

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

    // Clear
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, w, h);

    // Draw horizontal grid lines for octaves
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let midi = minPitch; midi <= maxPitch; midi += 12) {
      const y = pitchToY(midi, h);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Hit line (left side, 15% from left)
    const hitX = w * 0.15;
    ctx.strokeStyle = COLORS.hitLine;
    ctx.lineWidth = 2;
    ctx.shadowColor = COLORS.hitLine;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(hitX, 0);
    ctx.lineTo(hitX, h);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Draw notes
    const windowStart = currentTime - 0.5;
    const windowEnd = currentTime + lookAhead;
    const pixelsPerSecond = (w - hitX) / lookAhead;

    // Build set of judged note indices
    const judgmentMap = new Map<number, HitJudgment>();
    for (const j of recentJudgments) {
      judgmentMap.set(j.noteIndex, j.judgment);
    }

    for (let i = 0; i < notes.length; i++) {
      const note = notes[i]!;
      const noteEnd = note.startTime + note.duration;

      // Skip notes outside visible window
      if (noteEnd < windowStart || note.startTime > windowEnd) continue;

      const x = hitX + (note.startTime - currentTime) * pixelsPerSecond;
      const noteW = Math.max(note.duration * pixelsPerSecond, 4);
      const y = pitchToY(note.pitch, h);
      const noteH = Math.max((h / PITCH_RANGE) * 0.8, 6);

      // Color based on judgment
      const judgment = judgmentMap.get(i);
      if (judgment) {
        ctx.fillStyle = COLORS[judgment];
        ctx.globalAlpha = judgment === 'miss' ? 0.3 : 0.9;
      } else {
        ctx.fillStyle = COLORS.note;
        ctx.globalAlpha = 0.8;
      }

      // Rounded rectangle note block
      const radius = 3;
      ctx.beginPath();
      ctx.roundRect(x, y - noteH / 2, noteW, noteH, radius);
      ctx.fill();

      // Glow effect for upcoming notes
      if (!judgment && note.startTime > currentTime) {
        ctx.shadowColor = COLORS.note;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      ctx.globalAlpha = 1;

      // Note label for notes near the hit line
      if (Math.abs(x - hitX) < 60) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '10px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(midiToNoteName(note.pitch), x - 4, y + 3);
      }
    }

    rafId = requestAnimationFrame(draw);
  }

  function pitchToY(pitch: number, height: number): number {
    const normalized = (pitch - minPitch) / PITCH_RANGE;
    return height * (1 - normalized);
  }

  onMount(() => {
    rafId = requestAnimationFrame(draw);
  });

  onDestroy(() => {
    if (rafId) cancelAnimationFrame(rafId);
  });
</script>

<div class="highway-container">
  <canvas bind:this={canvas} class="highway-canvas"></canvas>
</div>

<style>
  .highway-container {
    width: 100%;
    height: 300px;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .highway-canvas {
    width: 100%;
    height: 100%;
    display: block;
  }
</style>
