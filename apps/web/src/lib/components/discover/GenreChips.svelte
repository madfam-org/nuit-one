<script lang="ts">
  interface Props {
    genres: string[];
    selected: string | null;
    onSelect: (genre: string | null) => void;
  }

  const { genres, selected, onSelect }: Props = $props();

  function capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
</script>

<div class="genre-chips" role="listbox" aria-label="Filter by genre">
  <button
    class="chip"
    class:active={selected === null}
    type="button"
    role="option"
    aria-selected={selected === null}
    onclick={() => onSelect(null)}
  >
    All
  </button>
  {#each genres as genre (genre)}
    <button
      class="chip"
      class:active={selected === genre}
      type="button"
      role="option"
      aria-selected={selected === genre}
      onclick={() => onSelect(genre)}
    >
      {capitalize(genre)}
    </button>
  {/each}
</div>

<style>
  .genre-chips {
    display: flex;
    gap: 0.5rem;
    overflow-x: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
    padding-bottom: 2px;
  }

  .genre-chips::-webkit-scrollbar {
    display: none;
  }

  .chip {
    flex-shrink: 0;
    padding: 0.375rem 0.875rem;
    border-radius: 9999px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.04);
    color: #a0a0b0;
    font-size: 0.8rem;
    font-weight: 500;
    font-family: 'Inter', system-ui, sans-serif;
    cursor: pointer;
    white-space: nowrap;
    transition:
      background 200ms ease,
      color 200ms ease,
      border-color 200ms ease,
      box-shadow 200ms ease;
    outline: none;
  }

  .chip:hover:not(.active) {
    background: rgba(255, 255, 255, 0.07);
    color: #d0d0d8;
  }

  .chip.active {
    background: rgba(0, 245, 255, 0.15);
    color: #00f5ff;
    border-color: rgba(0, 245, 255, 0.35);
    box-shadow: 0 0 10px rgba(0, 245, 255, 0.15);
  }

  .chip:focus-visible {
    box-shadow: 0 0 0 2px rgba(0, 245, 255, 0.4);
  }
</style>
