<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    href: string;
    icon: Snippet;
    label: string;
    active?: boolean;
    collapsed?: boolean;
  }

  const { href, icon, label, active = false, collapsed = false }: Props = $props();
</script>

<a
  {href}
  class="sidebar-item"
  class:active
  class:collapsed
  data-sveltekit-preload-data
  title={collapsed ? label : undefined}
  aria-current={active ? 'page' : undefined}
>
  <span class="icon">
    {@render icon()}
  </span>
  {#if !collapsed}
    <span class="label">{label}</span>
  {/if}
</a>

<style>
  .sidebar-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 8px;
    color: #a0a0b0;
    text-decoration: none;
    transition: all 0.15s ease;
    font-size: 14px;
    white-space: nowrap;
  }

  .collapsed {
    justify-content: center;
    padding: 10px;
  }

  .sidebar-item:hover {
    color: #f0f0f5;
    background: rgba(240, 240, 245, 0.06);
  }

  .active {
    color: #00f5ff;
    background: rgba(0, 245, 255, 0.08);
  }

  .active:hover {
    background: rgba(0, 245, 255, 0.12);
  }

  .icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  }

  .icon :global(svg) {
    width: 20px;
    height: 20px;
  }

  .label {
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
