<script lang="ts">
  interface Props {
    count?: number;
  }
  const { count = 0 }: Props = $props();
</script>

{#if count > 0}
  <span class="live-badge">
    <span class="live-dot"></span>
    LIVE {count > 1 ? `(${count})` : ''}
  </span>
{/if}

<style>
  .live-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.625rem;
    background: rgba(255, 0, 229, 0.12);
    border: 1px solid rgba(255, 0, 229, 0.3);
    border-radius: 9999px;
    color: #ff00e5;
    font-size: 0.625rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .live-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #ff00e5;
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
</style>
