<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import UploadZone from '$lib/components/UploadZone.svelte';
  import TrackList from '$lib/components/TrackList.svelte';
  import ProcessingStatus from '$lib/components/ProcessingStatus.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let processingTrackId = $state<string | null>(null);

  async function handleUploadComplete(trackId: string) {
    // Refresh the track list
    await invalidateAll();
    // Trigger stem separation
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
      }
    } catch {
      processingTrackId = null;
    }
  }

  function handleProcessingComplete() {
    processingTrackId = null;
    invalidateAll();
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

    {#if processingTrackId}
      <section>
        <ProcessingStatus trackId={processingTrackId} onComplete={handleProcessingComplete} />
      </section>
    {/if}

    <section>
      <h2 class="mb-3 text-lg font-semibold">Your Tracks</h2>
      <TrackList tracks={data.tracks} />
    </section>
  </main>
</div>
