<script lang="ts">
  import { onMount } from 'svelte';

  onMount(() => {
    // In production, redirect to Janua OAuth authorize endpoint
    // window.location.href = `${JANUA_URL}/oauth/authorize?...`;
  });
</script>

<div class="flex min-h-screen items-center justify-center">
  <div class="glass rounded-2xl p-8 text-center">
    <h2 class="text-2xl font-semibold">Sign in to Nuit One</h2>
    <p class="mt-2 text-text-secondary">Redirecting to authentication...</p>
    <div class="mt-6">
      <a
        href="/dashboard"
        class="rounded-lg bg-neon-cyan/10 px-6 py-3 text-neon-cyan transition-all hover:bg-neon-cyan/20"
      >
        Continue (Dev Mode)
      </a>
    </div>
  </div>
</div>
