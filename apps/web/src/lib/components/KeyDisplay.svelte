<script lang="ts">
  interface Props {
    keySignature: string;
    confidence?: number;
  }

  let { keySignature, confidence }: Props = $props();
</script>

<div class="key-display">
  <svg class="key-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M9 18V5l12-2v13"/>
    <circle cx="6" cy="18" r="3"/>
    <circle cx="18" cy="16" r="3"/>
  </svg>
  <span class="key-label">{keySignature}</span>
  {#if confidence !== undefined}
    <span class="confidence">{Math.round(confidence * 100)}%</span>
  {/if}
</div>

<style>
  .key-display {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    background: rgba(139, 92, 246, 0.12);
    border: 1px solid rgba(139, 92, 246, 0.3);
    border-radius: 6px;
    color: #8b5cf6;
    font-size: 13px;
    font-weight: 600;
  }

  .key-icon {
    flex-shrink: 0;
    opacity: 0.8;
  }

  .key-label {
    white-space: nowrap;
  }

  .confidence {
    font-size: 11px;
    font-weight: 400;
    opacity: 0.6;
  }
</style>
