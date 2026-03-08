<script lang="ts">
  import type { NoteEvent } from '@nuit-one/shared';

  interface Props {
    notes: NoteEvent[];
    currentTime: number;
    duration: number;
    width?: number;
    height?: number;
    color?: string;
  }

  let { notes, currentTime, duration, width = 800, height = 120, color = '#00f5ff' }: Props = $props();

  let canvas: HTMLCanvasElement | undefined = $state();

  $effect(() => {
    if (!canvas || notes.length === 0 || duration <= 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    // Compute pitch range
    const pitches = notes.map((n) => n.pitch);
    const minPitch = Math.min(...pitches) - 2;
    const maxPitch = Math.max(...pitches) + 2;
    const pitchRange = maxPitch - minPitch || 1;

    const pxPerSecond = width / duration;

    for (const note of notes) {
      const x = note.startTime * pxPerSecond;
      const w = Math.max(2, note.duration * pxPerSecond);
      const y = height - ((note.pitch - minPitch) / pitchRange) * (height - 4) - 2;
      const h = Math.max(2, (height - 4) / pitchRange);

      const isPast = note.startTime + note.duration < currentTime;
      const isCurrent = currentTime >= note.startTime && currentTime < note.startTime + note.duration;

      ctx.globalAlpha = isPast ? 0.3 : isCurrent ? 1 : 0.6;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h);

      if (isCurrent) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.shadowColor = color;
        ctx.shadowBlur = 6;
        ctx.strokeRect(x, y, w, h);
        ctx.shadowBlur = 0;
      }
    }

    ctx.globalAlpha = 1;

    // Playhead
    const playheadX = currentTime * pxPerSecond;
    ctx.strokeStyle = '#f0f0f5';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, height);
    ctx.stroke();
    ctx.setLineDash([]);
  });
</script>

<div class="midi-overlay">
  <canvas bind:this={canvas} style="width: {width}px; height: {height}px;"></canvas>
</div>

<style>
  .midi-overlay {
    position: relative;
    pointer-events: none;
  }

  canvas {
    display: block;
  }
</style>
