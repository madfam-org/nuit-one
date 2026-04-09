<script lang="ts">
  import { page } from '$app/stores';
</script>

<div class="error-page">
  <div class="error-card">
    <div class="error-code">{$page.status}</div>
    <h1 class="error-title">
      {#if $page.status === 404}
        Page Not Found
      {:else if $page.status === 401}
        Unauthorized
      {:else if $page.status === 500}
        Server Error
      {:else}
        Something Went Wrong
      {/if}
    </h1>
    <p class="error-message">{$page.error?.message ?? 'An unexpected error occurred.'}</p>
    <a href="/" class="error-link">Return Home</a>
  </div>
</div>

<style>
  .error-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #0a0a0f;
    color: #f0f0f5;
    font-family: 'Inter', system-ui, sans-serif;
    padding: 2rem;
  }

  .error-card {
    text-align: center;
    max-width: 420px;
    padding: 2.5rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 16px;
    backdrop-filter: blur(16px);
  }

  .error-code {
    font-size: 5rem;
    font-weight: 900;
    line-height: 1;
    color: #00f5ff;
    text-shadow: 0 0 40px rgba(0, 245, 255, 0.3);
    margin-bottom: 0.5rem;
  }

  .error-title {
    font-size: 1.25rem;
    font-weight: 600;
    margin-bottom: 0.75rem;
  }

  .error-message {
    font-size: 0.875rem;
    color: #a0a0b0;
    margin-bottom: 1.5rem;
    line-height: 1.5;
  }

  .error-link {
    display: inline-block;
    padding: 0.5rem 1.5rem;
    background: #00f5ff;
    color: #0a0a0f;
    font-weight: 500;
    font-size: 0.875rem;
    border-radius: 8px;
    text-decoration: none;
    transition: box-shadow 250ms ease;
  }

  .error-link:hover {
    box-shadow: 0 0 20px rgba(0, 245, 255, 0.3);
  }
</style>
