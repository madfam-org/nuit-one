<script lang="ts">
  import { enhance } from '$app/forms';
  import { onDestroy } from 'svelte';
  import { GlassCard, Button } from '@nuit-one/ui';
  import { CalibrationWizard } from '$lib/audio/calibration.js';
  import type { PageData } from './$types';

  let { data, form }: { data: PageData; form: { success?: boolean } | null } = $props();

  type Step = 'idle' | 'output' | 'input' | 'display' | 'done';

  let step = $state<Step>('idle');
  let outputLatency = $state(data.profile?.outputLatencyMs ?? 0);
  let inputLatency = $state(data.profile?.inputLatencyMs ?? 0);
  let displayLatency = $state(data.profile?.displayLatencyMs ?? 0);
  let measuring = $state(false);
  let error = $state('');

  let ctx: AudioContext | null = null;
  let wizard: CalibrationWizard | null = null;

  function ensureContext() {
    if (!ctx) {
      ctx = new AudioContext();
      wizard = new CalibrationWizard(ctx);
    }
  }

  async function startWizard() {
    step = 'output';
    await measureOutput();
  }

  async function measureOutput() {
    ensureContext();
    measuring = true;
    error = '';
    try {
      outputLatency = Math.round(await wizard!.measureOutputLatency() * 10) / 10;
      step = 'input';
    } catch (e) {
      error = 'Output measurement failed';
    }
    measuring = false;
  }

  async function measureInput() {
    ensureContext();
    measuring = true;
    error = '';
    try {
      inputLatency = Math.round(await wizard!.measureInputLatency() * 10) / 10;
      step = 'display';
    } catch (e) {
      error = 'Input measurement failed. Check microphone permissions.';
    }
    measuring = false;
  }

  async function measureDisplay() {
    ensureContext();
    measuring = true;
    error = '';
    try {
      displayLatency = Math.round(await wizard!.measureDisplayLatency() * 10) / 10;
      step = 'done';
    } catch (e) {
      error = 'Display measurement failed';
    }
    measuring = false;
  }

  function skipInput() {
    step = 'display';
  }

  onDestroy(() => {
    if (ctx) void ctx.close();
  });
</script>

<div class="min-h-screen bg-nuit-base p-8">
  <header class="mb-6">
    <a href="/dashboard" class="text-text-muted text-sm hover:text-text-secondary">&larr; Dashboard</a>
    <h1 class="text-xl font-bold mt-1">Latency Calibration</h1>
    <p class="text-text-muted text-sm">Measure your system's audio latency for accurate scoring</p>
  </header>

  <main class="mx-auto max-w-md space-y-6">
    {#if form?.success}
      <p class="text-green-400 text-sm text-center">Calibration saved!</p>
    {/if}

    {#if error}
      <p class="text-red-400 text-sm text-center">{error}</p>
    {/if}

    {#if step === 'idle'}
      <GlassCard padding="lg">
        <div class="text-center space-y-4">
          {#if data.profile}
            <div class="space-y-2">
              <p class="text-sm">Current calibration:</p>
              <div class="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p class="font-mono text-lg">{data.profile.outputLatencyMs.toFixed(1)}</p>
                  <p class="text-text-muted text-xs">Output (ms)</p>
                </div>
                <div>
                  <p class="font-mono text-lg">{data.profile.inputLatencyMs.toFixed(1)}</p>
                  <p class="text-text-muted text-xs">Input (ms)</p>
                </div>
                <div>
                  <p class="font-mono text-lg">{data.profile.displayLatencyMs.toFixed(1)}</p>
                  <p class="text-text-muted text-xs">Display (ms)</p>
                </div>
              </div>
            </div>
          {:else}
            <p class="text-text-muted text-sm">No calibration profile yet.</p>
          {/if}
          <Button variant="primary" onclick={startWizard}>
            {data.profile ? 'Recalibrate' : 'Start Calibration'}
          </Button>
        </div>
      </GlassCard>

    {:else if step === 'output'}
      <GlassCard padding="lg">
        <div class="text-center space-y-4">
          <h2 class="font-semibold">Step 1: Output Latency</h2>
          <p class="text-text-muted text-sm">Measuring audio output latency...</p>
          {#if measuring}
            <p class="text-neon-cyan animate-pulse">Measuring...</p>
          {:else}
            <p class="font-mono text-2xl text-neon-cyan">{outputLatency.toFixed(1)} ms</p>
          {/if}
        </div>
      </GlassCard>

    {:else if step === 'input'}
      <GlassCard padding="lg">
        <div class="text-center space-y-4">
          <h2 class="font-semibold">Step 2: Input Latency</h2>
          <p class="text-text-muted text-sm">
            Place your microphone near the speakers. A click will play and we'll measure the round-trip time.
          </p>
          <p class="font-mono text-sm text-text-muted">Output: {outputLatency.toFixed(1)} ms</p>
          {#if measuring}
            <p class="text-neon-cyan animate-pulse">Measuring...</p>
          {:else}
            <div class="flex gap-3 justify-center">
              <Button variant="primary" onclick={measureInput}>Measure</Button>
              <Button variant="ghost" onclick={skipInput}>Skip</Button>
            </div>
          {/if}
        </div>
      </GlassCard>

    {:else if step === 'display'}
      <GlassCard padding="lg">
        <div class="text-center space-y-4">
          <h2 class="font-semibold">Step 3: Display Latency</h2>
          <p class="text-text-muted text-sm">Measuring rendering latency...</p>
          {#if measuring}
            <p class="text-neon-cyan animate-pulse">Measuring...</p>
          {:else}
            <Button variant="primary" onclick={measureDisplay}>Measure</Button>
          {/if}
        </div>
      </GlassCard>

    {:else if step === 'done'}
      <GlassCard padding="lg">
        <div class="text-center space-y-4">
          <h2 class="font-semibold">Calibration Complete</h2>
          <div class="grid grid-cols-3 gap-2 text-center">
            <div>
              <p class="font-mono text-lg text-neon-cyan">{outputLatency.toFixed(1)}</p>
              <p class="text-text-muted text-xs">Output (ms)</p>
            </div>
            <div>
              <p class="font-mono text-lg text-neon-cyan">{inputLatency.toFixed(1)}</p>
              <p class="text-text-muted text-xs">Input (ms)</p>
            </div>
            <div>
              <p class="font-mono text-lg text-neon-cyan">{displayLatency.toFixed(1)}</p>
              <p class="text-text-muted text-xs">Display (ms)</p>
            </div>
          </div>

          <form method="POST" action="?/save" use:enhance>
            <input type="hidden" name="deviceName" value="Default" />
            <input type="hidden" name="outputLatencyMs" value={outputLatency.toString()} />
            <input type="hidden" name="inputLatencyMs" value={inputLatency.toString()} />
            <input type="hidden" name="displayLatencyMs" value={displayLatency.toString()} />
            <Button variant="primary" type="submit">Save Profile</Button>
          </form>
        </div>
      </GlassCard>
    {/if}
  </main>
</div>
