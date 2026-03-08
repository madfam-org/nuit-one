<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  interface Props {
    peaks: Float32Array | null;
    currentTime: number;
    duration: number;
    loopStart?: number | null;
    loopEnd?: number | null;
    color?: string;
    onSeek?: (time: number) => void;
    onLoopSelect?: (start: number, end: number) => void;
  }

  const {
    peaks,
    currentTime,
    duration,
    loopStart = null,
    loopEnd = null,
    color = '#8b5cf6',
    onSeek,
    onLoopSelect,
  }: Props = $props();

  let canvas: HTMLCanvasElement;
  let rafId: number;
  let isDragging = $state(false);
  let dragStartX = 0;
  let dragStartTime = 0;

  function draw() {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx || !peaks || peaks.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const mid = h / 2;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Loop region highlight
    if (loopStart !== null && loopEnd !== null && duration > 0) {
      const x1 = (loopStart / duration) * w;
      const x2 = (loopEnd / duration) * w;
      ctx.fillStyle = 'rgba(0, 245, 255, 0.08)';
      ctx.fillRect(x1, 0, x2 - x1, h);

      // Loop boundaries
      ctx.strokeStyle = 'rgba(0, 245, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(x1, 0); ctx.lineTo(x1, h);
      ctx.moveTo(x2, 0); ctx.lineTo(x2, h);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Waveform bars
    const barWidth = Math.max(1, w / peaks.length);
    const playheadX = duration > 0 ? (currentTime / duration) * w : 0;

    for (let i = 0; i < peaks.length; i++) {
      const x = (i / peaks.length) * w;
      const amp = peaks[i]! * mid * 0.9;

      // Color: past = brighter, future = dimmer
      if (x < playheadX) {
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.9;
      } else {
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.3;
      }

      ctx.fillRect(x, mid - amp, barWidth, amp * 2);
    }

    ctx.globalAlpha = 1;

    // Playhead line
    if (duration > 0) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, h);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    rafId = requestAnimationFrame(draw);
  }

  function handleClick(e: MouseEvent) {
    if (isDragging) return;
    if (!onSeek || !canvas || duration <= 0) return;
    const rect = canvas.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    onSeek(pct * duration);
  }

  function handleMouseDown(e: MouseEvent) {
    if (!onLoopSelect || !canvas || duration <= 0) return;
    if (e.shiftKey) {
      isDragging = true;
      const rect = canvas.getBoundingClientRect();
      dragStartX = e.clientX;
      dragStartTime = ((e.clientX - rect.left) / rect.width) * duration;
    }
  }

  function handleMouseMove(e: MouseEvent) {
    if (!isDragging || !canvas || !onLoopSelect) return;
    // Visual feedback handled by draw()
  }

  function handleMouseUp(e: MouseEvent) {
    if (!isDragging || !canvas || !onLoopSelect || duration <= 0) return;
    isDragging = false;
    const rect = canvas.getBoundingClientRect();
    const endTime = ((e.clientX - rect.left) / rect.width) * duration;
    const start = Math.max(0, Math.min(dragStartTime, endTime));
    const end = Math.min(duration, Math.max(dragStartTime, endTime));
    if (end - start > 0.1) {
      onLoopSelect(start, end);
    }
  }

  onMount(() => {
    rafId = requestAnimationFrame(draw);
  });

  onDestroy(() => {
    if (rafId) cancelAnimationFrame(rafId);
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="waveform-container"
  onclick={handleClick}
  onmousedown={handleMouseDown}
  onmousemove={handleMouseMove}
  onmouseup={handleMouseUp}
>
  <canvas bind:this={canvas} class="waveform-canvas"></canvas>
</div>

<style>
  .waveform-container {
    width: 100%;
    height: 60px;
    cursor: pointer;
    border-radius: 6px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(255, 255, 255, 0.02);
  }

  .waveform-canvas {
    width: 100%;
    height: 100%;
    display: block;
  }
</style>
