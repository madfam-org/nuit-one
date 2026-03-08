<script lang="ts">
  interface Tab {
    id: string;
    label: string;
  }

  interface Props {
    tabs: Tab[];
    activeTab: string;
    onTabChange?: (tabId: string) => void;
  }

  const { tabs, activeTab, onTabChange }: Props = $props();
</script>

<div class="tab-bar" role="tablist">
  {#each tabs as tab}
    <button
      class="tab"
      class:active={activeTab === tab.id}
      role="tab"
      aria-selected={activeTab === tab.id}
      onclick={() => onTabChange?.(tab.id)}
    >
      {tab.label}
    </button>
  {/each}
</div>

<style>
  .tab-bar {
    display: flex;
    gap: 0;
    border-bottom: 1px solid rgba(240, 240, 245, 0.08);
  }

  .tab {
    padding: 10px 16px;
    border: none;
    background: transparent;
    color: #a0a0b0;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    position: relative;
    transition: color 0.15s ease;
  }

  .tab:hover {
    color: #f0f0f5;
  }

  .tab:focus-visible {
    outline: none;
    box-shadow: inset 0 0 0 2px rgba(0, 245, 255, 0.4);
    border-radius: 4px;
  }

  .active {
    color: #00f5ff;
  }

  .active::after {
    content: '';
    position: absolute;
    bottom: -1px;
    left: 0;
    right: 0;
    height: 2px;
    background: #00f5ff;
    box-shadow: 0 0 8px rgba(0, 245, 255, 0.5);
    border-radius: 2px 2px 0 0;
  }
</style>
