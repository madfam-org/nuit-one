<script lang="ts">
  
  import { Button, GlassCard } from '@nuit-one/ui';
import { page } from '$app/stores';
</script>

<div class="app-error">
  <GlassCard>
    <div class="error-content">
      <span class="error-code">{$page.status}</span>
      <h1 class="error-title">
        {#if $page.status === 404}
          Not Found
        {:else if $page.status === 401}
          Unauthorized
        {:else}
          Something went wrong
        {/if}
      </h1>
      <p class="error-message">{$page.error?.message ?? 'An unexpected error occurred.'}</p>
      <div class="error-actions">
        <Button variant="secondary" onclick={() => window.history.back()}>Go Back</Button>
        <Button variant="ghost" onclick={() => window.location.href = '/library'}>Library</Button>
      </div>
    </div>
  </GlassCard>
</div>

<style>
  .app-error {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    padding: 2rem;
  }

  .error-content {
    text-align: center;
    padding: 2rem;
    max-width: 380px;
  }

  .error-code {
    font-size: 3.5rem;
    font-weight: 900;
    line-height: 1;
    color: #00f5ff;
    text-shadow: 0 0 30px rgba(0, 245, 255, 0.25);
    display: block;
    margin-bottom: 0.5rem;
  }

  .error-title {
    font-size: 1.125rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: #f0f0f5;
  }

  .error-message {
    font-size: 0.875rem;
    color: #a0a0b0;
    margin-bottom: 1.5rem;
    line-height: 1.5;
  }

  .error-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: center;
  }
</style>
