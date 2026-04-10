<script lang="ts">
  import { GlassCard, NeonBadge, TabBar } from '@nuit-one/ui';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  let activeTab = $state('tracks');

  const statusColors: Record<string, 'cyan' | 'magenta' | 'violet' | 'amber' | 'green'> = {
    ready: 'green',
    processing: 'amber',
    uploaded: 'cyan',
    pending_upload: 'violet',
    error: 'magenta',
  };

  function formatDuration(seconds: number | null): string {
    if (seconds == null) return '';
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
</script>

<div class="library-page">
  <header class="library-header">
    <h1 class="page-title">Library</h1>
  </header>

  <TabBar
    tabs={[
      { id: 'tracks', label: 'Tracks' },
      { id: 'projects', label: 'Projects' },
    ]}
    {activeTab}
    onTabChange={(id) => (activeTab = id)}
  />

  <div class="library-content">
    {#if activeTab === 'tracks'}
      {#if data.tracks.length === 0}
        <div class="empty-state">
          <GlassCard padding="lg">
            <p class="empty-text">No tracks yet. Upload a song from the <a href="/dashboard" class="link">dashboard</a>.</p>
          </GlassCard>
        </div>
      {:else}
        <div class="list">
          {#each data.tracks as track (track.id)}
            <a href="/tracks/{track.id}" class="list-item" data-sveltekit-preload-data>
              <div class="item-main">
                <span class="item-title">{track.title}</span>
                <span class="item-meta">
                  {#if track.artist}
                    {track.artist}
                    {#if track.instrument || track.durationSeconds} &middot; {/if}
                  {/if}
                  {#if track.instrument}
                    {track.instrument}
                    {#if track.durationSeconds} &middot; {/if}
                  {/if}
                  {#if track.durationSeconds}
                    {formatDuration(track.durationSeconds)}
                  {/if}
                </span>
              </div>
              <div class="item-end">
                {#if track.sourceType}
                  <NeonBadge color="violet">{track.sourceType}</NeonBadge>
                {/if}
                {#if track.status === 'ready' && track.hasNotes}
                  <button
                    class="quick-play-btn"
                    aria-label="Play {track.title}"
                    onclick={(e) => { e.preventDefault(); e.stopPropagation(); window.location.href = `/perform/${track.id}`; }}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </button>
                {/if}
                <NeonBadge color={statusColors[track.status] ?? 'cyan'}>{track.status}</NeonBadge>
              </div>
            </a>
          {/each}
        </div>
      {/if}

    {:else}
      {#if data.projects.length === 0}
        <div class="empty-state">
          <GlassCard padding="lg">
            <p class="empty-text">No projects yet. Create one from the <a href="/projects" class="link">projects page</a>.</p>
          </GlassCard>
        </div>
      {:else}
        <div class="list">
          {#each data.projects as project (project.id)}
            <a href="/studio/{project.id}" class="list-item" data-sveltekit-preload-data>
              <div class="item-main">
                <span class="item-title">{project.name}</span>
                <span class="item-meta">{project.tempoBpm} BPM · {project.timeSignature} · {project.trackCount} tracks</span>
              </div>
            </a>
          {/each}
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .library-page {
    padding: 1.5rem;
    max-width: 960px;
    margin: 0 auto;
  }

  .library-header {
    margin-bottom: 1rem;
  }

  .page-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #f0f0f5;
  }

  .library-content {
    margin-top: 1rem;
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .list-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background: rgba(18, 18, 26, 0.6);
    border-radius: 8px;
    text-decoration: none;
    color: #f0f0f5;
    transition: transform 150ms ease, background 150ms ease;
  }

  .list-item:hover {
    background: rgba(18, 18, 26, 0.9);
    transform: scale(1.01);
  }

  .item-main {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .item-title {
    font-size: 0.875rem;
    font-weight: 500;
  }

  .item-meta {
    font-size: 0.75rem;
    color: #606070;
  }

  .item-end {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .quick-play-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgba(0, 245, 255, 0.15);
    color: #00f5ff;
    text-decoration: none;
    transition: all 150ms ease;
    flex-shrink: 0;
  }

  .quick-play-btn:hover {
    background: rgba(0, 245, 255, 0.3);
    transform: scale(1.1);
  }

  .empty-state {
    padding: 2rem;
    text-align: center;
  }

  .empty-text {
    color: #a0a0b0;
    font-size: 0.875rem;
  }

  .link {
    color: #00f5ff;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
</style>
