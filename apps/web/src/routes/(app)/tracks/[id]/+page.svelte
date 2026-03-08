<script lang="ts">
  import AudioPlayer from '$lib/components/AudioPlayer.svelte';
  import { Button } from '@nuit-one/ui';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const hasNotes = $derived(data.stems.some((s: { hasMidiData: boolean }) => s.hasMidiData));
</script>

<div class="min-h-screen bg-nuit-base p-8">
  <header class="mb-6 flex items-center justify-between">
    <div>
      <a href="/dashboard" class="text-text-muted text-sm hover:text-text-secondary">&larr; Back to tracks</a>
      <h1 class="text-xl font-bold mt-1">{data.track.title}</h1>
    </div>
    <div class="flex gap-3">
      {#if hasNotes}
        <a href="/tracks/{data.track.id}/play">
          <Button variant="primary">Play Mode</Button>
        </a>
      {/if}
    </div>
  </header>

  <main class="mx-auto max-w-3xl">
    <AudioPlayer stemUrls={data.stemUrls} />
  </main>
</div>
