<script lang="ts">
  import { onDestroy, onMount } from 'svelte';

  interface DataPoint {
    date: string;
    score: number;
    accuracy: number;
  }

  interface Props {
    data: DataPoint[];
  }

  const { data }: Props = $props();

  let canvas: HTMLCanvasElement;
  let rafId: number;

  const COLORS = {
    score: '#00f5ff',
    accuracy: '#00ff88',
    grid: 'rgba(255, 255, 255, 0.06)',
    text: '#606070',
    background: '#0a0a0f',
  };

  function draw() {
    if (!canvas || data.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const padding = { top: 20, right: 20, bottom: 30, left: 40 };
    const plotW = w - padding.left - padding.right;
    const plotH = h - padding.top - padding.bottom;

    // Clear
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, w, h);

    // Y-axis grid lines (0, 25, 50, 75, 100)
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.font = '10px monospace';
    ctx.fillStyle = COLORS.text;
    ctx.textAlign = 'right';

    for (let v = 0; v <= 100; v += 25) {
      const y = padding.top + plotH * (1 - v / 100);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();
      ctx.fillText(`${v}`, padding.left - 6, y + 3);
    }

    if (data.length < 2) {
      // Single point — draw as dot
      const p = data[0]!;
      const x = padding.left + plotW / 2;
      const yScore = padding.top + plotH * (1 - Math.min(p.score, 100) / 100);
      const yAcc = padding.top + plotH * (1 - Math.min(p.accuracy, 100) / 100);

      drawDot(ctx, x, yScore, COLORS.score);
      drawDot(ctx, x, yAcc, COLORS.accuracy);
      return;
    }

    // Draw lines
    drawLine(ctx, data.map((d) => Math.min(d.score, 100)), plotW, plotH, padding, COLORS.score);
    drawLine(ctx, data.map((d) => Math.min(d.accuracy, 100)), plotW, plotH, padding, COLORS.accuracy);

    // X-axis labels (first, last)
    ctx.fillStyle = COLORS.text;
    ctx.textAlign = 'center';
    ctx.font = '9px monospace';
    const first = new Date(data[0]!.date);
    const last = new Date(data[data.length - 1]!.date);
    ctx.fillText(formatDate(first), padding.left, h - 6);
    ctx.fillText(formatDate(last), w - padding.right, h - 6);
  }

  function drawLine(
    ctx: CanvasRenderingContext2D,
    values: number[],
    plotW: number, plotH: number,
    padding: { top: number; right: number; bottom: number; left: number },
    color: string
  ) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;

    ctx.beginPath();
    for (let i = 0; i < values.length; i++) {
      const x = padding.left + (i / (values.length - 1)) * plotW;
      const y = padding.top + plotH * (1 - values[i]! / 100);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Dots
    for (let i = 0; i < values.length; i++) {
      const x = padding.left + (i / (values.length - 1)) * plotW;
      const y = padding.top + plotH * (1 - values[i]! / 100);
      drawDot(ctx, x, y, color);
    }
  }

  function drawDot(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  function formatDate(d: Date): string {
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }

  onMount(() => {
    draw();
    // Redraw on resize
    const observer = new ResizeObserver(() => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(draw);
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  });

  onDestroy(() => {
    if (rafId) cancelAnimationFrame(rafId);
  });
</script>

<div class="chart-container">
  <div class="legend">
    <span class="legend-item"><span class="legend-dot" style:background={COLORS.score}></span> Score</span>
    <span class="legend-item"><span class="legend-dot" style:background={COLORS.accuracy}></span> Accuracy</span>
  </div>
  <canvas bind:this={canvas} class="chart-canvas"></canvas>
</div>

<style>
  .chart-container {
    width: 100%;
  }

  .legend {
    display: flex;
    gap: 1rem;
    justify-content: center;
    margin-bottom: 0.5rem;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    color: #a0a0b0;
  }

  .legend-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .chart-canvas {
    width: 100%;
    height: 200px;
    display: block;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.06);
  }
</style>
