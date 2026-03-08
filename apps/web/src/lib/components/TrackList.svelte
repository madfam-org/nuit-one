<script lang="ts">
  import type { Track } from '@nuit-one/shared';
  import { GlassCard, NeonBadge } from '@nuit-one/ui';

  interface Props {
    tracks: Track[];
  }

  const { tracks }: Props = $props();

  const statusColors: Record<string, 'cyan' | 'magenta' | 'violet' | 'amber' | 'green'> = {
    pending_upload: 'amber',
    uploaded: 'violet',
    processing: 'magenta',
    ready: 'green',
    error: 'amber',
  };

  const statusLabels: Record<string, string> = {
    pending_upload: 'Uploading',
    uploaded: 'Uploaded',
    processing: 'Processing',
    ready: 'Ready',
    error: 'Error',
  };

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatSize(bytes: number | null): string {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
</script>

{#if tracks.length === 0}
  <p class="text-text-muted text-sm">No tracks yet. Upload a song to get started.</p>
{:else}
  <div class="track-list">
    {#each tracks as track (track.id)}
      <a href={track.status === 'ready' ? `/tracks/${track.id}` : undefined} class="track-link" class:clickable={track.status === 'ready'}>
        <GlassCard variant={track.status === 'ready' ? 'interactive' : 'default'} padding="sm">
          <div class="track-row">
            <div class="track-info">
              <span class="track-title">{track.title}</span>
              <span class="track-meta">
                {formatSize(track.fileSizeBytes)}
                {#if track.createdAt}
                  · {formatDate(track.createdAt)}
                {/if}
              </span>
            </div>
            <NeonBadge color={statusColors[track.status] ?? 'cyan'}>
              {statusLabels[track.status] ?? track.status}
            </NeonBadge>
          </div>
        </GlassCard>
      </a>
    {/each}
  </div>
{/if}

<style>
  .track-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .track-link {
    text-decoration: none;
    color: inherit;
  }

  .track-link.clickable {
    cursor: pointer;
  }

  .track-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .track-info {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    min-width: 0;
  }

  .track-title {
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .track-meta {
    font-size: 0.75rem;
    color: #606070;
  }
</style>
