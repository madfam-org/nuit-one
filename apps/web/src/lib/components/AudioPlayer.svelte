<script lang="ts">
  import { onDestroy } from 'svelte';
  import { GlassCard } from '@nuit-one/ui';
  import TransportBar from './TransportBar.svelte';
  import StemMixer from './StemMixer.svelte';
  import { createPlayerStore } from '$lib/stores/player.svelte.js';

  interface Props {
    stemUrls: Record<string, string>;
    bassKaraokeMode?: boolean;
  }

  const { stemUrls, bassKaraokeMode = true }: Props = $props();

  const player = createPlayerStore();

  $effect(() => {
    void player.loadStems(stemUrls, bassKaraokeMode);

    return () => {
      player.destroy();
    };
  });
</script>

<GlassCard padding="lg">
  {#if player.loading}
    <div class="loading">
      <p class="loading-text">Loading audio...</p>
      <div class="loading-bar">
        <div class="loading-pulse"></div>
      </div>
    </div>
  {:else}
    <div class="player">
      <TransportBar {player} />
      <div class="divider"></div>
      <StemMixer {player} />

      {#if bassKaraokeMode}
        <div class="karaoke-hint">
          <span class="hint-icon">🎸</span>
          <span class="hint-text">Bass Karaoke Mode — plug in your bass and play along!</span>
        </div>
      {/if}
    </div>
  {/if}
</GlassCard>

<style>
  .player {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.06);
  }

  .loading {
    text-align: center;
    padding: 2rem 0;
  }

  .loading-text {
    color: #a0a0b0;
    margin-bottom: 1rem;
  }

  .loading-bar {
    width: 200px;
    height: 3px;
    margin: 0 auto;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 2px;
    overflow: hidden;
  }

  .loading-pulse {
    width: 40%;
    height: 100%;
    background: #00f5ff;
    border-radius: 2px;
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(350%); }
  }

  .karaoke-hint {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: rgba(0, 245, 255, 0.05);
    border-radius: 8px;
    border: 1px solid rgba(0, 245, 255, 0.1);
  }

  .hint-icon {
    font-size: 1rem;
  }

  .hint-text {
    font-size: 0.75rem;
    color: #a0a0b0;
  }
</style>
