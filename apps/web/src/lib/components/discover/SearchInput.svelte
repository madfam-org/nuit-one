<script lang="ts">
  import { onDestroy } from 'svelte';

  interface Props {
    onSearch: (query: string) => void;
    placeholder?: string;
  }

  const { onSearch, placeholder = 'Search tracks, artists...' }: Props = $props();

  let value = $state('');
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function handleInput(event: Event & { currentTarget: HTMLInputElement }) {
    value = event.currentTarget.value;
    if (debounceTimer != null) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      onSearch(value.trim());
    }, 300);
  }

  function clear() {
    value = '';
    if (debounceTimer != null) clearTimeout(debounceTimer);
    onSearch('');
  }

  onDestroy(() => {
    if (debounceTimer != null) clearTimeout(debounceTimer);
  });
</script>

<div class="search-input-wrap">
  <svg
    class="search-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    width="16"
    height="16"
    aria-hidden="true"
  >
    <circle cx="11" cy="11" r="8"/>
    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>

  <input
    type="text"
    class="search-input"
    {placeholder}
    {value}
    oninput={handleInput}
    aria-label="Search catalog tracks"
  />

  {#if value.length > 0}
    <button
      class="clear-btn"
      type="button"
      onclick={clear}
      aria-label="Clear search"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  {/if}
</div>

<style>
  .search-input-wrap {
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
    background: rgba(255, 255, 255, 0.04);
    backdrop-filter: blur(16px) saturate(180%);
    -webkit-backdrop-filter: blur(16px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    transition: border-color 250ms ease, box-shadow 250ms ease;
  }

  .search-input-wrap:focus-within {
    border-color: rgba(0, 245, 255, 0.5);
    box-shadow: 0 0 12px rgba(0, 245, 255, 0.15);
  }

  .search-icon {
    position: absolute;
    left: 0.875rem;
    color: #606070;
    pointer-events: none;
    flex-shrink: 0;
  }

  .search-input {
    width: 100%;
    padding: 0.75rem 1rem 0.75rem 2.5rem;
    border: none;
    border-radius: 12px;
    background: transparent;
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.875rem;
    color: #f0f0f5;
    outline: none;
  }

  .search-input::placeholder {
    color: #606070;
  }

  .clear-btn {
    position: absolute;
    right: 0.625rem;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: none;
    background: rgba(255, 255, 255, 0.06);
    color: #a0a0b0;
    cursor: pointer;
    transition: background 150ms ease, color 150ms ease;
    padding: 0;
  }

  .clear-btn:hover {
    background: rgba(255, 255, 255, 0.12);
    color: #f0f0f5;
  }

  .clear-btn:focus-visible {
    box-shadow: 0 0 0 2px rgba(0, 245, 255, 0.4);
  }
</style>
