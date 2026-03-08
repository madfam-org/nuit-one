<script lang="ts">
  import { page } from '$app/stores';

  let projectSlug = $derived($page.params.project);
</script>

<div class="min-h-screen bg-nuit-base p-8">
  <h1 class="text-2xl font-bold">
    Project: <span class="text-neon-cyan">{projectSlug}</span>
  </h1>
</div>
