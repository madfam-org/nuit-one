<script lang="ts">
  
  import { Button } from '@nuit-one/ui';
  import { detectBPM } from '$lib/audio/bpm-detector.js';
import AudioPlayer from '$lib/components/AudioPlayer.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const hasNotes = $derived(data.stems.some((s: { hasMidiData: boolean }) => s.hasMidiData));

  let detectedBpm = $state<number | null>(null);
  let detecting = $state(false);

  async function handleDetectBpm() {
    if (!data.stemUrls.length) return;
    detecting = true;
    try {
      const ctx = new AudioContext();
      const res = await fetch(data.stemUrls[0]!);
      const arrayBuf = await res.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuf);
      detectedBpm = detectBPM(audioBuffer);
      ctx.close();
    } catch (err) {
      console.error('BPM detection failed:', err);
    } finally {
      detecting = false;
    }
  }
</script>

<div class="min-h-screen bg-nuit-base p-8">
  <header class="mb-6 flex items-center justify-between">
    <div>
      <a href="/dashboard" class="text-text-muted text-sm hover:text-text-secondary">&larr; Back to tracks</a>
      <h1 class="text-xl font-bold mt-1">{data.track.title}</h1>
      <p class="text-text-muted text-xs mt-0.5">{data.track.tempoBpm} BPM &middot; {data.track.timeSignature}</p>
    </div>
    <div class="flex items-center gap-3">
      <Button variant="ghost" onclick={handleDetectBpm} disabled={detecting}>
        {detecting ? 'Detecting...' : 'Detect BPM'}
      </Button>
      {#if detectedBpm !== null}
        <span class="text-xs font-mono text-amber-400">{detectedBpm} BPM detected</span>
      {/if}
      <a href="/tracks/{data.track.id}/stats">
        <Button variant="ghost">Stats</Button>
      </a>
      {#if hasNotes}
        <a href="/perform/{data.track.id}">
          <Button variant="primary">Play Mode</Button>
        </a>
      {/if}
    </div>
  </header>

  <main class="mx-auto max-w-3xl">
    <AudioPlayer stemUrls={data.stemUrls} />
  </main>
</div>
