<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    variant?: 'default' | 'elevated' | 'interactive';
    padding?: 'sm' | 'md' | 'lg';
    class?: string;
    children?: Snippet;
  }

  const { variant = 'default', padding = 'md', class: className = '', children }: Props = $props();

  const paddings = {
    sm: '0.75rem',
    md: '1.25rem',
    lg: '2rem',
  } as const;

  const backgrounds = {
    default: 'rgba(255, 255, 255, 0.04)',
    elevated: 'rgba(255, 255, 255, 0.07)',
    interactive: 'rgba(255, 255, 255, 0.04)',
  } as const;
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  class="nuit-glass-card {className}"
  class:interactive={variant === 'interactive'}
  style:--gc-padding={paddings[padding]}
  style:--gc-bg={backgrounds[variant]}
  role={variant === 'interactive' ? 'button' : undefined}
  tabindex={variant === 'interactive' ? 0 : undefined}
>
  {#if children}
    {@render children()}
  {/if}
</div>

<style>
  .nuit-glass-card {
    padding: var(--gc-padding);
    background: var(--gc-bg);
    backdrop-filter: blur(16px) saturate(180%);
    -webkit-backdrop-filter: blur(16px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    color: #f0f0f5;
    transition: box-shadow 250ms cubic-bezier(0.4, 0, 0.2, 1),
                border-color 250ms cubic-bezier(0.4, 0, 0.2, 1),
                background 250ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  .nuit-glass-card.interactive {
    cursor: pointer;
    outline: none;
  }

  .nuit-glass-card.interactive:hover {
    border-color: rgba(255, 255, 255, 0.14);
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.4),
      0 0 20px rgba(0, 245, 255, 0.12);
    background: rgba(255, 255, 255, 0.06);
  }

  .nuit-glass-card.interactive:focus-visible {
    border-color: rgba(0, 245, 255, 0.5);
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.4),
      0 0 0 2px rgba(0, 245, 255, 0.3);
  }

  .nuit-glass-card.interactive:active {
    background: rgba(255, 255, 255, 0.08);
    transform: scale(0.99);
  }
</style>
