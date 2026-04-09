<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<div class="flex min-h-screen items-center justify-center">
  <div class="glass rounded-2xl p-8 text-center">
    <h2 class="text-2xl font-semibold">Sign in to Nuit One</h2>
    {#if data.devMode}
      <p class="mt-2 text-text-secondary">Development mode</p>
      <div class="mt-6">
        <a
          href="/dashboard"
          class="rounded-lg bg-neon-cyan/10 px-6 py-3 text-neon-cyan transition-all hover:bg-neon-cyan/20"
        >
          Continue (Dev Mode)
        </a>
      </div>
    {:else}
      <p class="mt-2 text-text-secondary">Redirecting to authentication...</p>
    {/if}
  </div>
</div>
