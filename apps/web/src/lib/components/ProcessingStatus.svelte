<script lang="ts">
  
  import { GlassCard, NeonBadge } from '@nuit-one/ui';
import { onDestroy } from 'svelte';

  interface Props {
    trackId: string;
    jobId?: string | null;
    onComplete: () => void;
  }

  const { trackId, jobId: externalJobId, onComplete }: Props = $props();

  let status = $state<string>('queued');
  let progress = $state(0);
  let errorMsg = $state('');
  let internalJobId = $state<string | null>(null);
  let jobId = $derived(externalJobId ?? internalJobId);

  const statusLabels: Record<string, string> = {
    queued: 'Queued',
    downloading: 'Downloading audio...',
    processing: 'Separating stems with AI...',
    uploading: 'Saving stems...',
    complete: 'Done!',
    error: 'Error',
  };

  // If no jobId was provided externally, trigger processing to get one
  $effect(() => {
    if (externalJobId || internalJobId || !trackId) return;

    fetch('/api/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackId }),
    })
      .then((r) => r.json())
      .then((data) => {
        internalJobId = data.jobId;
      })
      .catch((err) => {
        errorMsg = err instanceof Error ? err.message : 'Failed to start processing';
      });
  });

  let pollInterval: ReturnType<typeof setInterval> | null = null;

  $effect(() => {
    if (!jobId) return;

    pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/process/${jobId}`);
        if (!res.ok) return;

        const job = await res.json();
        status = job.status;
        progress = job.progress;

        if (job.status === 'complete') {
          if (pollInterval) clearInterval(pollInterval);
          onComplete();
        } else if (job.status === 'error') {
          if (pollInterval) clearInterval(pollInterval);
          errorMsg = job.error ?? 'Processing failed';
        }
      } catch {
        // Ignore poll errors, retry on next interval
      }
    }, 3000);

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  });

  onDestroy(() => {
    if (pollInterval) clearInterval(pollInterval);
  });
</script>

<GlassCard>
  <div class="processing-container">
    <div class="processing-header">
      <span class="processing-title">Processing Track</span>
      <NeonBadge color={status === 'error' ? 'amber' : 'magenta'}>
        {statusLabels[status] ?? status}
      </NeonBadge>
    </div>

    <div class="progress-bar">
      <div class="progress-fill" style:width="{progress}%"></div>
    </div>

    {#if errorMsg}
      <p class="error-msg">{errorMsg}</p>
    {/if}
  </div>
</GlassCard>

<style>
  .processing-container {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .processing-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .processing-title {
    font-weight: 500;
  }

  .progress-bar {
    width: 100%;
    height: 4px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #ff00e5, #8b5cf6);
    border-radius: 2px;
    transition: width 300ms ease;
    box-shadow: 0 0 10px rgba(255, 0, 229, 0.4);
  }

  .error-msg {
    color: #ff4466;
    font-size: 0.875rem;
  }
</style>
