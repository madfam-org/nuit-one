<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    color?: 'cyan' | 'magenta' | 'violet' | 'amber' | 'green';
    class?: string;
    children?: Snippet;
  }

  const { color = 'cyan', class: className = '', children }: Props = $props();

  const palette = {
    cyan:    { bg: 'rgba(0, 245, 255, 0.12)', text: '#00f5ff', glow: 'rgba(0, 245, 255, 0.25)' },
    magenta: { bg: 'rgba(255, 0, 229, 0.12)', text: '#ff00e5', glow: 'rgba(255, 0, 229, 0.25)' },
    violet:  { bg: 'rgba(139, 92, 246, 0.12)', text: '#8b5cf6', glow: 'rgba(139, 92, 246, 0.25)' },
    amber:   { bg: 'rgba(245, 158, 11, 0.12)', text: '#f59e0b', glow: 'rgba(245, 158, 11, 0.25)' },
    green:   { bg: 'rgba(0, 255, 136, 0.12)', text: '#00ff88', glow: 'rgba(0, 255, 136, 0.25)' },
  } as const;
</script>

<span
  class="nuit-badge {className}"
  style:--badge-bg={palette[color].bg}
  style:--badge-text={palette[color].text}
  style:--badge-glow={palette[color].glow}
>
  {#if children}
    {@render children()}
  {/if}
</span>

<style>
  .nuit-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.125rem 0.625rem;
    font-family: "Inter", system-ui, sans-serif;
    font-size: 0.75rem;
    font-weight: 500;
    line-height: 1.5;
    color: var(--badge-text);
    background: var(--badge-bg);
    border-radius: 9999px;
    box-shadow: 0 0 8px var(--badge-glow);
    white-space: nowrap;
    user-select: none;
  }
</style>
