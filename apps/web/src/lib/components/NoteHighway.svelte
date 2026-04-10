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
    /** Current combo count for milestone effects */
    combo?: number;
  }

  const { notes, currentTime, lookAhead = 4, recentJudgments = [],
          minPitch = 28, maxPitch = 72, combo = 0 }: Props = $props();

  let canvas: HTMLCanvasElement;
  let rafId: number;

  // --- Particle & effect state ---
  interface Particle {
    x: number; y: number;
    vx: number; vy: number;
    life: number; maxLife: number;
    color: string; radius: number;
  }

  let particles: Particle[] = [];
  let lastHitTime = 0;
  let lastJudgmentCount = 0;
  let lastComboMilestone = 0;
  let comboFlashStart = 0;
  let prefersReducedMotion = false;

  // Check reduced motion on mount
  $effect(() => {
    if (typeof window !== 'undefined') {
      prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
  });

  // Detect new judgments to trigger effects
  $effect(() => {
    if (recentJudgments.length > lastJudgmentCount) {
      const latest = recentJudgments[recentJudgments.length - 1];
      lastHitTime = performance.now();
      if (latest?.judgment === 'perfect' && !prefersReducedMotion) {
        spawnParticles();
      }
      lastJudgmentCount = recentJudgments.length;
    }
  });

  // Detect combo milestones
  $effect(() => {
    const c = combo ?? 0;
    const milestones = [10, 25, 50, 100];
    for (const m of milestones) {
      if (c >= m && lastComboMilestone < m) {
        comboFlashStart = performance.now();
        lastComboMilestone = m;
      }
    }
    if (c === 0) lastComboMilestone = 0;
  });

  function spawnParticles() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const spawnX = rect.width * 0.15;
    const midY = rect.height / 2;

    for (let i = 0; i < 7; i++) {
      particles.push({
        x: spawnX,
        y: midY + (Math.random() - 0.5) * rect.height * 0.3,
        vx: (Math.random() - 0.3) * 4,
        vy: (Math.random() - 0.5) * 5,
        life: 400 + Math.random() * 200,
        maxLife: 400 + Math.random() * 200,
        color: '#00f5ff',
        radius: 2 + Math.random() * 2,
      });
    }
    // Cap particles
    if (particles.length > 50) particles = particles.slice(-50);
  }

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

    // --- Visual effects (skip if user prefers reduced motion) ---
    if (!prefersReducedMotion) {
      // Hit flash effect
      const timeSinceHit = performance.now() - lastHitTime;
      if (timeSinceHit < 150) {
        const alpha = 0.3 * (1 - timeSinceHit / 150);
        const gradient = ctx.createRadialGradient(hitX, h / 2, 0, hitX, h / 2, h * 0.4);
        gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(hitX - h * 0.4, 0, h * 0.8, h);
      }

      // Combo milestone flash
      const timeSinceCombo = performance.now() - comboFlashStart;
      if (timeSinceCombo < 300 && comboFlashStart > 0) {
        const cAlpha = 0.06 * (1 - timeSinceCombo / 300);
        ctx.fillStyle = `rgba(0, 245, 255, ${cAlpha})`;
        ctx.fillRect(0, 0, w, h);
      }

      // Particles
      const now = performance.now();
      particles = particles.filter(p => {
        p.life -= 16; // ~60fps
        if (p.life <= 0) return false;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1; // gravity
        const pAlpha = p.life / p.maxLife;
        ctx.globalAlpha = pAlpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * pAlpha, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        return true;
      });
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
    height: 100%;
    min-height: 200px;
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
