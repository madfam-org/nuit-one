<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    text: string;
    position?: 'top' | 'right' | 'bottom' | 'left';
    children: Snippet;
  }

  const { text, position = 'top', children }: Props = $props();
  let visible = $state(false);
</script>

<div
  class="tooltip-wrapper"
  onmouseenter={() => (visible = true)}
  onmouseleave={() => (visible = false)}
  onfocusin={() => (visible = true)}
  onfocusout={() => (visible = false)}
>
  {@render children()}
  {#if visible}
    <div class="tooltip {position}" role="tooltip">
      {text}
    </div>
  {/if}
</div>

<style>
  .tooltip-wrapper {
    position: relative;
    display: inline-flex;
  }

  .tooltip {
    position: absolute;
    padding: 4px 10px;
    border-radius: 6px;
    background: rgba(26, 26, 46, 0.95);
    border: 1px solid rgba(0, 245, 255, 0.2);
    color: #f0f0f5;
    font-size: 12px;
    white-space: nowrap;
    pointer-events: none;
    z-index: 1000;
    backdrop-filter: blur(8px);
  }

  .top {
    bottom: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
  }
  .bottom {
    top: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
  }
  .left {
    right: calc(100% + 8px);
    top: 50%;
    transform: translateY(-50%);
  }
  .right {
    left: calc(100% + 8px);
    top: 50%;
    transform: translateY(-50%);
  }
</style>
