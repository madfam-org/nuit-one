<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title?: string;
    collapsible?: boolean;
    children: Snippet;
  }

  const { title, collapsible = false, children }: Props = $props();
  let collapsed = $state(false);
</script>

<div class="sidebar-section">
  {#if title}
    <button
      class="section-header"
      class:collapsible
      onclick={() => collapsible && (collapsed = !collapsed)}
      disabled={!collapsible}
    >
      <span class="section-title">{title}</span>
      {#if collapsible}
        <svg class="chevron" class:rotated={!collapsed} width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M3 4.5l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      {/if}
    </button>
  {/if}
  {#if !collapsed}
    <div class="section-content">
      {@render children()}
    </div>
  {/if}
</div>

<style>
  .sidebar-section {
    margin-bottom: 8px;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 6px 12px;
    border: none;
    background: transparent;
    color: #606070;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    cursor: default;
  }

  .collapsible {
    cursor: pointer;
  }

  .collapsible:hover {
    color: #a0a0b0;
  }

  .chevron {
    transition: transform 0.2s ease;
  }

  .rotated {
    transform: rotate(180deg);
  }

  .section-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
</style>
