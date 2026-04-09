<script lang="ts">
  
  import { Button, GlassCard } from '@nuit-one/ui';
import { enhance } from '$app/forms';
  import type { PageData } from './$types';

  let { data, form }: { data: PageData; form: { error?: string; success?: boolean } | null } = $props();

  const TIME_SIGNATURES = ['4/4', '3/4', '6/8', '2/4', '5/4', '7/8', '12/8'];
</script>

<div class="min-h-screen bg-nuit-base p-8">
  <header class="mb-6">
    <a href="/projects/{data.project.id}" class="text-text-muted text-sm hover:text-text-secondary">&larr; Back to project</a>
    <h1 class="text-xl font-bold mt-1">{data.project.name}</h1>
    <p class="text-text-muted text-sm">Project Settings</p>
  </header>

  <main class="mx-auto max-w-md space-y-6">
    {#if form?.error}
      <p class="text-red-400 text-sm">{form.error}</p>
    {/if}
    {#if form?.success}
      <p class="text-green-400 text-sm">Settings saved.</p>
    {/if}

    <GlassCard padding="md">
      <h2 class="text-sm font-semibold mb-3">Tempo</h2>
      <form method="POST" action="?/updateTempo" use:enhance class="flex gap-3 items-end">
        <div class="flex-1">
          <label for="tempoBpm" class="text-text-muted text-xs block mb-1">BPM</label>
          <input
            id="tempoBpm"
            type="number"
            name="tempoBpm"
            value={data.project.tempoBpm}
            min="20"
            max="300"
            class="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white focus:border-neon-cyan focus:outline-none"
          />
        </div>
        <Button variant="primary" size="sm" type="submit">Save</Button>
      </form>
    </GlassCard>

    <GlassCard padding="md">
      <h2 class="text-sm font-semibold mb-3">Time Signature</h2>
      <form method="POST" action="?/updateTimeSignature" use:enhance class="flex gap-3 items-end">
        <div class="flex-1">
          <select
            name="timeSignature"
            class="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white focus:border-neon-cyan focus:outline-none"
          >
            {#each TIME_SIGNATURES as ts}
              <option value={ts} selected={ts === data.project.timeSignature}>{ts}</option>
            {/each}
          </select>
        </div>
        <Button variant="primary" size="sm" type="submit">Save</Button>
      </form>
    </GlassCard>
  </main>
</div>
