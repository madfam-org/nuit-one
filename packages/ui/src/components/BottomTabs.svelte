<script lang="ts">
  import type { Snippet } from 'svelte';

  interface TabItem {
    href: string;
    label: string;
    icon: Snippet;
  }

  interface Props {
    items: TabItem[];
    activeHref: string;
  }

  const { items, activeHref }: Props = $props();
</script>

<nav class="bottom-tabs" aria-label="Mobile navigation">
  {#each items as item}
    <a
      href={item.href}
      class="tab-item"
      class:active={activeHref === item.href || activeHref.startsWith(item.href + '/')}
      data-sveltekit-preload-data
      aria-current={activeHref === item.href || activeHref.startsWith(item.href + '/') ? 'page' : undefined}
    >
      <span class="tab-icon">
        {@render item.icon()}
      </span>
      <span class="tab-label">{item.label}</span>
    </a>
  {/each}
</nav>

<style>
  .bottom-tabs {
    display: flex;
    align-items: stretch;
    height: 56px;
    background: rgba(10, 10, 15, 0.95);
    backdrop-filter: blur(16px);
    border-top: 1px solid rgba(240, 240, 245, 0.08);
  }

  .tab-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    text-decoration: none;
    color: #606070;
    transition: color 0.15s ease;
  }

  .tab-item:hover {
    color: #a0a0b0;
  }

  .active {
    color: #00f5ff;
  }

  .tab-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
  }

  .tab-icon :global(svg) {
    width: 24px;
    height: 24px;
  }

  .tab-label {
    font-size: 10px;
    font-weight: 500;
  }
</style>
