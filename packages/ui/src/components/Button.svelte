<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    variant?: 'primary' | 'secondary' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
    class?: string;
    onclick?: (event: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }) => void;
    children?: Snippet;
  }

  const {
    variant = 'primary',
    size = 'md',
    disabled = false,
    class: className = '',
    onclick,
    children,
  }: Props = $props();

  const sizes = {
    sm: { padding: '0.375rem 0.75rem', fontSize: '0.75rem' },
    md: { padding: '0.5rem 1.125rem', fontSize: '0.875rem' },
    lg: { padding: '0.625rem 1.5rem', fontSize: '1rem' },
  } as const;
</script>

<button
  class="nuit-btn nuit-btn--{variant} {className}"
  style:--btn-padding={sizes[size].padding}
  style:--btn-font-size={sizes[size].fontSize}
  {disabled}
  {onclick}
  type="button"
>
  {#if children}
    {@render children()}
  {/if}
</button>

<style>
  .nuit-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: var(--btn-padding);
    font-family: "Inter", system-ui, sans-serif;
    font-size: var(--btn-font-size);
    font-weight: 500;
    line-height: 1.5;
    border-radius: 8px;
    border: 1px solid transparent;
    cursor: pointer;
    outline: none;
    white-space: nowrap;
    user-select: none;
    transition:
      background 250ms cubic-bezier(0.4, 0, 0.2, 1),
      box-shadow 250ms cubic-bezier(0.4, 0, 0.2, 1),
      border-color 250ms cubic-bezier(0.4, 0, 0.2, 1),
      color 150ms cubic-bezier(0.4, 0, 0.2, 1),
      opacity 150ms ease;
  }

  .nuit-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    pointer-events: none;
  }

  /* ---------- Primary ---------- */
  .nuit-btn--primary {
    background: #00f5ff;
    color: #0a0a0f;
    border-color: #00f5ff;
  }

  .nuit-btn--primary:hover {
    box-shadow: 0 0 20px rgba(0, 245, 255, 0.3);
    background: #1af7ff;
  }

  .nuit-btn--primary:focus-visible {
    box-shadow:
      0 0 0 2px #0a0a0f,
      0 0 0 4px rgba(0, 245, 255, 0.6);
  }

  .nuit-btn--primary:active {
    background: #00d4dd;
  }

  /* ---------- Secondary ---------- */
  .nuit-btn--secondary {
    background: rgba(255, 255, 255, 0.04);
    color: #f0f0f5;
    border-color: rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(16px) saturate(180%);
    -webkit-backdrop-filter: blur(16px) saturate(180%);
  }

  .nuit-btn--secondary:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.14);
  }

  .nuit-btn--secondary:focus-visible {
    box-shadow: 0 0 0 2px rgba(0, 245, 255, 0.4);
    border-color: rgba(0, 245, 255, 0.5);
  }

  .nuit-btn--secondary:active {
    background: rgba(255, 255, 255, 0.1);
  }

  /* ---------- Ghost ---------- */
  .nuit-btn--ghost {
    background: transparent;
    color: #a0a0b0;
    border-color: transparent;
  }

  .nuit-btn--ghost:hover {
    color: #f0f0f5;
    background: rgba(255, 255, 255, 0.04);
  }

  .nuit-btn--ghost:focus-visible {
    box-shadow: 0 0 0 2px rgba(0, 245, 255, 0.4);
  }

  .nuit-btn--ghost:active {
    background: rgba(255, 255, 255, 0.06);
    color: #f0f0f5;
  }
</style>
