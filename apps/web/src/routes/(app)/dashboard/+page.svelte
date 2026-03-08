<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import UploadZone from '$lib/components/UploadZone.svelte';
  import TrackList from '$lib/components/TrackList.svelte';
  import ProcessingStatus from '$lib/components/ProcessingStatus.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

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
      <span class="text-text-secondary text-sm">{data.user?.displayName ?? 'User'}</span>
    </div>
  </header>

  <main class="mx-auto max-w-3xl space-y-6">
    <section>
      <h2 class="mb-3 text-lg font-semibold">Upload a Song</h2>
      <UploadZone onUploadComplete={handleUploadComplete} />
    </section>

    <section>
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
      <section>
        <ProcessingStatus trackId={processingTrackId} jobId={processingJobId} onComplete={handleProcessingComplete} />
      </section>
    {/if}

    <section>
      <h2 class="mb-3 text-lg font-semibold">Your Tracks</h2>
      <TrackList tracks={data.tracks} />
    </section>
  </main>
</div>
