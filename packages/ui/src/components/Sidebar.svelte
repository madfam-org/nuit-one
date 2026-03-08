<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    collapsed: boolean;
    onToggle?: () => void;
    children: Snippet;
  }

  const { collapsed, onToggle, children }: Props = $props();
</script>

<aside class="sidebar" class:collapsed aria-label="Main navigation">
  <div class="sidebar-header">
    {#if !collapsed}
      <span class="logo-text">nuit</span>
    {/if}
    {#if onToggle}
      <button class="toggle-btn" onclick={onToggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          {#if collapsed}
            <path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          {:else}
            <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          {/if}
        </svg>
      </button>
    {/if}
  </div>
  <nav class="sidebar-nav">
    {@render children()}
  </nav>
</aside>

<style>
  .sidebar {
    display: flex;
    flex-direction: column;
    width: 240px;
    height: 100%;
    background: rgba(12, 12, 20, 0.85);
    backdrop-filter: blur(16px);
    border-right: 1px solid rgba(240, 240, 245, 0.08);
    transition: width 0.2s ease;
    overflow: hidden;
    flex-shrink: 0;
  }

  .collapsed {
    width: 64px;
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    height: 56px;
  }

  .collapsed .sidebar-header {
    justify-content: center;
    padding: 16px 8px;
  }

  .logo-text {
    font-size: 20px;
    font-weight: 700;
    color: #00f5ff;
    letter-spacing: 0.08em;
  }

  .toggle-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: #a0a0b0;
    cursor: pointer;
    transition: color 0.2s, background 0.2s;
  }

  .toggle-btn:hover {
    color: #f0f0f5;
    background: rgba(240, 240, 245, 0.08);
  }

  .toggle-btn:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px rgba(0, 245, 255, 0.4);
  }

  .sidebar-nav {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }

  .collapsed .sidebar-nav {
    padding: 8px 4px;
  }
</style>
