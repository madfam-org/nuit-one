<script lang="ts">
  
  import { onMount } from 'svelte';
import { goto, invalidateAll } from '$app/navigation';
  import OnboardingModal from '$lib/components/OnboardingModal.svelte';
  import ProcessingStatus from '$lib/components/ProcessingStatus.svelte';
  import TrackList from '$lib/components/TrackList.svelte';
  import UploadZone from '$lib/components/UploadZone.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let calibrationDismissed = $state(false);
  let showOnboarding = $state(false);

  onMount(() => {
    calibrationDismissed = localStorage.getItem('nuit-calibration-dismissed') === 'true';
    if (!localStorage.getItem('nuit-onboarding-complete')) {
      showOnboarding = true;
    }
  });

  function completeOnboarding() {
    localStorage.setItem('nuit-onboarding-complete', 'true');
    showOnboarding = false;
  }

  async function tryDemo() {
    localStorage.setItem('nuit-onboarding-complete', 'true');
    showOnboarding = false;
    try {
      const res = await fetch('/api/demo/seed', { method: 'POST' });
      if (res.ok) {
        const { trackId } = await res.json();
        await goto(`/perform/${trackId}`);
      }
    } catch {
      // If demo seed fails, stay on dashboard
    }
  }

  function dismissCalibration() {
    calibrationDismissed = true;
    localStorage.setItem('nuit-calibration-dismissed', 'true');
  }

  let processingTrackId = $state<string | null>(null);
  let processingJobId = $state<string | null>(null);

  // YouTube import state
  let youtubeUrl = $state('');
  let youtubeImporting = $state(false);
  let youtubeError = $state('');

  async function handleUploadComplete(trackId: string) {
    await invalidateAll();
    processingTrackId = trackId;
    try {
      const res = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId }),
      });
      if (!res.ok) {
        console.error('Failed to trigger processing');
        processingTrackId = null;
        return;
      }
      const result = await res.json();
      processingJobId = result.jobId;
    } catch {
      processingTrackId = null;
      processingJobId = null;
    }
  }

  function handleProcessingComplete() {
    processingTrackId = null;
    processingJobId = null;
    invalidateAll();
  }

  async function handleYouTubeImport() {
    if (!youtubeUrl.trim()) return;
    youtubeError = '';
    youtubeImporting = true;

    try {
      const res = await fetch('/api/import/youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: youtubeUrl }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Import failed' }));
        youtubeError = data.error ?? 'Import failed';
        youtubeImporting = false;
        return;
      }
      const result = await res.json();
      processingJobId = result.jobId;
      processingTrackId = 'youtube-import';
      youtubeUrl = '';
      youtubeImporting = false;
    } catch {
      youtubeError = 'Failed to start import';
      youtubeImporting = false;
    }
  }
</script>

<div class="min-h-screen bg-nuit-base p-8">
  <header class="mb-8 flex items-center justify-between">
    <h1 class="text-2xl font-bold">
      <span class="text-neon-cyan">Nuit</span> One
    </h1>
    <div class="flex items-center gap-4">
      <a href="/projects" class="text-text-secondary text-sm hover:text-neon-cyan transition-colors">Projects</a>
      <span class="text-text-secondary text-sm">{data.user?.displayName ?? 'User'}</span>
    </div>
  </header>

  <main class="mx-auto max-w-3xl space-y-6">
    {#if !data.hasCalibration && !calibrationDismissed}
      <div class="calibration-banner">
        <div class="calibration-content">
          <div class="calibration-text">
            <strong>Calibrate your audio setup</strong>
            <span>For accurate scoring, calibrate your mic and speaker latency.</span>
          </div>
          <div class="calibration-actions">
            <a href="/settings/calibration" class="calibrate-btn">Calibrate Now</a>
            <button class="dismiss-btn" onclick={dismissCalibration} aria-label="Dismiss calibration prompt">&times;</button>
          </div>
        </div>
      </div>
    {/if}

    <section class="dashboard-section">
      <h2 class="mb-3 text-lg font-semibold">Upload a Song</h2>
      <UploadZone onUploadComplete={handleUploadComplete} />
    </section>

    <section class="dashboard-section">
      <h2 class="mb-3 text-lg font-semibold">Import from YouTube</h2>
      <div class="flex gap-3">
        <input
          type="text"
          bind:value={youtubeUrl}
          placeholder="https://www.youtube.com/watch?v=..."
          class="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-white/30 focus:border-neon-cyan focus:outline-none"
          disabled={youtubeImporting}
        />
        <button
          onclick={handleYouTubeImport}
          disabled={youtubeImporting || !youtubeUrl.trim()}
          class="rounded-lg bg-neon-cyan/20 px-4 py-2 text-sm font-medium text-neon-cyan transition hover:bg-neon-cyan/30 disabled:opacity-40"
        >
          {youtubeImporting ? 'Importing...' : 'Import'}
        </button>
      </div>
      {#if youtubeError}
        <p class="mt-2 text-sm text-red-400">{youtubeError}</p>
      {/if}
    </section>

    {#if processingTrackId}
      <section class="dashboard-section">
        <ProcessingStatus trackId={processingTrackId} jobId={processingJobId} onComplete={handleProcessingComplete} />
      </section>
    {/if}

    <section class="dashboard-section">
      <h2 class="mb-3 text-lg font-semibold">Your Tracks</h2>
      <TrackList tracks={data.tracks} />
    </section>
  </main>
</div>

{#if showOnboarding}
  <OnboardingModal onComplete={completeOnboarding} onTryDemo={tryDemo} />
{/if}

<style>
  .calibration-banner {
    margin-bottom: 1.5rem;
    padding: 1rem 1.25rem;
    background: rgba(0, 245, 255, 0.04);
    border: 1px solid rgba(0, 245, 255, 0.15);
    border-left: 3px solid #00f5ff;
    border-radius: 12px;
  }

  .calibration-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .calibration-text {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .calibration-text strong {
    font-size: 0.875rem;
    color: #f0f0f5;
  }

  .calibration-text span {
    font-size: 0.8rem;
    color: #a0a0b0;
  }

  .calibration-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-shrink: 0;
  }

  .calibrate-btn {
    padding: 0.375rem 1rem;
    background: rgba(0, 245, 255, 0.12);
    color: #00f5ff;
    border-radius: 8px;
    font-size: 0.8rem;
    font-weight: 500;
    text-decoration: none;
    transition: background 200ms ease, box-shadow 200ms ease;
    white-space: nowrap;
  }

  .calibrate-btn:hover {
    background: rgba(0, 245, 255, 0.2);
    box-shadow: 0 0 12px rgba(0, 245, 255, 0.2);
  }

  .dismiss-btn {
    background: none;
    border: none;
    color: #606070;
    font-size: 1.25rem;
    cursor: pointer;
    padding: 0.25rem;
    line-height: 1;
    transition: color 150ms ease;
  }

  .dismiss-btn:hover {
    color: #a0a0b0;
  }

  /* --- Stagger entrance animation --- */

  .dashboard-section {
    opacity: 0;
    animation: nuit-slide-up 350ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
  }
  .dashboard-section:nth-of-type(1) { animation-delay: 0ms; }
  .dashboard-section:nth-of-type(2) { animation-delay: 80ms; }
  .dashboard-section:nth-of-type(3) { animation-delay: 160ms; }
  .dashboard-section:nth-of-type(4) { animation-delay: 240ms; }

  @media (prefers-reduced-motion: reduce) {
    .dashboard-section {
      opacity: 1;
      animation: none;
    }
  }
</style>
