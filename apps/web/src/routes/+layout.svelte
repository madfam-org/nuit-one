<script lang="ts">
  import '../app.css';
  import { onNavigate } from '$app/navigation';

  let { children } = $props();

  onNavigate((navigation) => {
    // Progressive enhancement: only use View Transitions if supported
    if (!document.startViewTransition) return;

    return new Promise((resolve) => {
      document.startViewTransition(async () => {
        resolve();
        await navigation.complete;
      });
    });
  });
</script>

{@render children()}
