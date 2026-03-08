<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    variant?: 'primary' | 'secondary' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
    onclick?: () => void;
    'aria-label': string;
    children: Snippet;
  }

  const {
    variant = 'ghost',
    size = 'md',
    disabled = false,
    onclick,
    'aria-label': ariaLabel,
    children,
  }: Props = $props();
</script>

<button
  class="icon-button {variant} {size}"
  {disabled}
  {onclick}
  aria-label={ariaLabel}
>
  {@render children()}
</button>

<style>
  .icon-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    color: #f0f0f5;
    background: transparent;
  }

  .icon-button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .icon-button:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px rgba(0, 245, 255, 0.4);
  }

  .icon-button :global(svg) {
    width: 100%;
    height: 100%;
  }

  /* Sizes */
  .sm { padding: 4px; width: 28px; height: 28px; }
  .md { padding: 6px; width: 36px; height: 36px; }
  .lg { padding: 8px; width: 44px; height: 44px; }

  /* Variants */
  .primary {
    background: rgba(0, 245, 255, 0.15);
  }
  .primary:hover:not(:disabled) {
    background: rgba(0, 245, 255, 0.25);
    box-shadow: 0 0 12px rgba(0, 245, 255, 0.3);
  }

  .secondary {
    background: rgba(139, 92, 246, 0.15);
  }
  .secondary:hover:not(:disabled) {
    background: rgba(139, 92, 246, 0.25);
    box-shadow: 0 0 12px rgba(139, 92, 246, 0.3);
  }

  .ghost {
    background: transparent;
  }
  .ghost:hover:not(:disabled) {
    background: rgba(240, 240, 245, 0.1);
  }
</style>
