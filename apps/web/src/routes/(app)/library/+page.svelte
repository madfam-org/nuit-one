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
                {#if track.instrument}
                  <span class="item-meta">{track.instrument}</span>
                {/if}
              </div>
              <div class="item-end">
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
    transition: background 0.15s ease;
  }

  .list-item:hover {
    background: rgba(18, 18, 26, 0.9);
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
