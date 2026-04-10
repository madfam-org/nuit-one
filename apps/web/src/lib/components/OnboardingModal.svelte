<script lang="ts">
  import { Button, GlassCard } from '@nuit-one/ui';

  interface Props {
    onComplete: () => void;
    onTryDemo: () => void;
  }

  const { onComplete, onTryDemo }: Props = $props();

  let step = $state(0);

  const steps = [
    {
      title: 'Welcome to Nuit One',
      body: 'Transform any song into an interactive performance. AI separates the stems — you play along with your real instrument and get scored in real-time.',
      action: 'Next',
    },
    {
      title: 'Tune Your Setup',
      body: 'For the most accurate scoring, calibrate your microphone and speaker latency. This takes about 30 seconds.',
      action: 'Next',
    },
    {
      title: 'Start Playing',
      body: 'Try a demo track to see how it works, or upload your own song to get started.',
      action: null,
    },
  ];

  function next() {
    if (step < steps.length - 1) {
      step++;
    }
  }

  function skip() {
    onComplete();
  }
</script>

<div class="onboarding-overlay" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
  <GlassCard>
    <div class="onboarding-content">
      <div class="step-indicators">
        {#each steps as _, i}
          <div class="step-dot" class:active={i === step} class:completed={i < step}></div>
        {/each}
      </div>

      <h2 id="onboarding-title" class="onboarding-title">{steps[step].title}</h2>
      <p class="onboarding-body">{steps[step].body}</p>

      {#if step === 1}
        <a href="/settings/calibration" class="calibrate-link" onclick={onComplete}>
          Calibrate Now
        </a>
      {/if}

      <div class="onboarding-actions">
        {#if step < 2}
          <Button variant="primary" onclick={next}>{steps[step].action}</Button>
          <Button variant="ghost" onclick={skip}>Skip</Button>
        {:else}
          <Button variant="primary" onclick={onTryDemo}>Try a Demo</Button>
          <Button variant="secondary" onclick={onComplete}>Upload My Own</Button>
        {/if}
      </div>
    </div>
  </GlassCard>
</div>

<style>
  .onboarding-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(10, 10, 15, 0.85);
    backdrop-filter: blur(8px);
    z-index: 200;
    padding: 1.5rem;
    animation: nuit-fade-in 300ms ease forwards;
  }

  .onboarding-content {
    text-align: center;
    max-width: 400px;
    padding: 1.5rem;
  }

  .step-indicators {
    display: flex;
    justify-content: center;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
  }

  .step-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.15);
    transition: all 250ms ease;
  }

  .step-dot.active {
    background: #00f5ff;
    box-shadow: 0 0 8px rgba(0, 245, 255, 0.4);
  }

  .step-dot.completed {
    background: rgba(0, 245, 255, 0.4);
  }

  .onboarding-title {
    font-size: 1.375rem;
    font-weight: 700;
    color: #f0f0f5;
    margin-bottom: 0.75rem;
  }

  .onboarding-body {
    font-size: 0.875rem;
    color: #a0a0b0;
    line-height: 1.6;
    margin-bottom: 1.5rem;
  }

  .calibrate-link {
    display: inline-block;
    padding: 0.5rem 1.25rem;
    background: rgba(0, 245, 255, 0.1);
    color: #00f5ff;
    border-radius: 8px;
    font-size: 0.8rem;
    font-weight: 500;
    text-decoration: none;
    margin-bottom: 1.25rem;
    transition: background 200ms ease;
  }

  .calibrate-link:hover {
    background: rgba(0, 245, 255, 0.2);
  }

  .onboarding-actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }
</style>
