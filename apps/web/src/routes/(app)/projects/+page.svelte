<script lang="ts">
  import { enhance } from '$app/forms';
  import { GlassCard, Button } from '@nuit-one/ui';
  import type { PageData } from './$types';

  let { data, form }: { data: PageData; form: { error?: string; success?: boolean } | null } = $props();

  let showNewForm = $state(false);
  let renamingId = $state<string | null>(null);
  let deleteConfirmId = $state<string | null>(null);

  const TIME_SIGNATURES = ['4/4', '3/4', '6/8', '2/4', '5/4', '7/8', '12/8'];
</script>

<div class="min-h-screen bg-nuit-base p-8">
  <header class="mb-8 flex items-center justify-between">
    <div>
      <a href="/dashboard" class="text-text-muted text-sm hover:text-text-secondary">&larr; Dashboard</a>
      <h1 class="text-2xl font-bold mt-1">Projects</h1>
    </div>
    <Button variant="primary" onclick={() => (showNewForm = !showNewForm)}>
      {showNewForm ? 'Cancel' : 'New Project'}
    </Button>
  </header>

  <main class="mx-auto max-w-3xl space-y-4">
    {#if form?.error}
      <p class="text-red-400 text-sm">{form.error}</p>
    {/if}

    {#if showNewForm}
      <GlassCard padding="md">
        <form method="POST" action="?/create" use:enhance class="space-y-3">
          <input
            type="text"
            name="name"
            placeholder="Project name"
            required
            class="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-white/30 focus:border-neon-cyan focus:outline-none"
          />
          <div class="flex gap-3">
            <div class="flex-1">
              <label class="text-text-muted text-xs block mb-1">Tempo (BPM)</label>
              <input
                type="number"
                name="tempoBpm"
                value="120"
                min="20"
                max="300"
                class="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white focus:border-neon-cyan focus:outline-none"
              />
            </div>
            <div class="flex-1">
              <label class="text-text-muted text-xs block mb-1">Time Signature</label>
              <select
                name="timeSignature"
                class="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white focus:border-neon-cyan focus:outline-none"
              >
                {#each TIME_SIGNATURES as ts}
                  <option value={ts} selected={ts === '4/4'}>{ts}</option>
                {/each}
              </select>
            </div>
          </div>
          <Button variant="primary" type="submit">Create Project</Button>
        </form>
      </GlassCard>
    {/if}

    {#if data.projects.length === 0}
      <p class="text-text-muted text-center py-12">No projects yet. Create one to get started.</p>
    {:else}
      {#each data.projects as project (project.id)}
        <GlassCard padding="md">
          <div class="flex items-center justify-between">
            <div class="flex-1">
              {#if renamingId === project.id}
                <form method="POST" action="?/rename" use:enhance={() => {
                  return async ({ update }) => {
                    renamingId = null;
                    await update();
                  };
                }} class="flex gap-2">
                  <input type="hidden" name="id" value={project.id} />
                  <input
                    type="text"
                    name="name"
                    value={project.name}
                    required
                    class="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-sm text-white focus:border-neon-cyan focus:outline-none"
                  />
                  <Button variant="ghost" size="sm" type="submit">Save</Button>
                  <Button variant="ghost" size="sm" onclick={() => (renamingId = null)}>Cancel</Button>
                </form>
              {:else}
                <a href="/projects/{project.id}" class="block group">
                  <h3 class="font-semibold group-hover:text-neon-cyan transition-colors">{project.name}</h3>
                  <p class="text-text-muted text-xs mt-0.5">
                    {project.trackCount} {project.trackCount === 1 ? 'track' : 'tracks'} &middot;
                    {project.tempoBpm} BPM &middot;
                    {project.timeSignature}
                  </p>
                </a>
              {/if}
            </div>

            {#if renamingId !== project.id}
              <div class="flex gap-1">
                <Button variant="ghost" size="sm" onclick={() => (renamingId = project.id)}>Rename</Button>
                {#if deleteConfirmId === project.id}
                  <form method="POST" action="?/delete" use:enhance>
                    <input type="hidden" name="id" value={project.id} />
                    <Button variant="ghost" size="sm" type="submit">Confirm Delete</Button>
                  </form>
                  <Button variant="ghost" size="sm" onclick={() => (deleteConfirmId = null)}>Cancel</Button>
                {:else}
                  <Button variant="ghost" size="sm" onclick={() => (deleteConfirmId = project.id)}>Delete</Button>
                {/if}
              </div>
            {/if}
          </div>
        </GlassCard>
      {/each}
    {/if}
  </main>
</div>
