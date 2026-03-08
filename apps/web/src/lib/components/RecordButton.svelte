<script lang="ts">
  import { Button } from '@nuit-one/ui';
  import { Recorder } from '$lib/audio/recorder.js';
  import { encodeWav } from '$lib/audio/wav-encoder.js';

  interface Props {
    audioContext: AudioContext;
    onRecordingComplete?: (blob: Blob) => void;
  }

  const { audioContext, onRecordingComplete }: Props = $props();

  type RecordState = 'idle' | 'requesting' | 'recording' | 'processing';

  let recordState = $state<RecordState>('idle');
  let level = $state(0);
  let recorder: Recorder | null = null;
  let levelInterval: ReturnType<typeof setInterval> | null = null;

  async function startRecording() {
    recordState = 'requesting';
    recorder = new Recorder(audioContext);

    try {
      await recorder.start();
      recordState = 'recording';

      // Level metering
      levelInterval = setInterval(() => {
        if (recorder) level = recorder.getLevel();
      }, 50);
    } catch (err) {
      console.error('Failed to start recording:', err);
      recordState = 'idle';
      recorder = null;
    }
  }

  async function stopRecording() {
    if (!recorder) return;
    recordState = 'processing';

    if (levelInterval) {
      clearInterval(levelInterval);
      levelInterval = null;
    }

    const blob = await recorder.stop();
    recorder = null;
    level = 0;

    // Decode to AudioBuffer, re-encode as WAV for consistent format
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const wavBlob = encodeWav(audioBuffer);
      onRecordingComplete?.(wavBlob);
    } catch (err) {
      console.error('Failed to process recording:', err);
      // Fallback: return original blob
      onRecordingComplete?.(blob);
    }

    recordState = 'idle';
  }
</script>

<div class="record-controls">
  {#if recordState === 'idle'}
    <Button variant="ghost" size="sm" onclick={startRecording}>
      <span class="record-dot"></span>
      Record
    </Button>
  {:else if recordState === 'requesting'}
    <Button variant="ghost" size="sm" disabled>
      Requesting mic...
    </Button>
  {:else if recordState === 'recording'}
    <div class="recording-indicator">
      <button class="stop-btn" onclick={stopRecording}>
        <span class="record-dot recording"></span>
        Stop
      </button>
      <div class="level-meter">
        <div class="level-fill" style:width="{Math.min(level * 300, 100)}%"></div>
      </div>
    </div>
  {:else if recordState === 'processing'}
    <Button variant="ghost" size="sm" disabled>
      Processing...
    </Button>
  {/if}
</div>

<style>
  .record-controls {
    display: inline-flex;
    align-items: center;
  }

  .record-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #ff4466;
    display: inline-block;
  }

  .record-dot.recording {
    animation: pulse-red 1s ease-in-out infinite;
  }

  @keyframes pulse-red {
    0%, 100% { opacity: 1; box-shadow: 0 0 4px #ff4466; }
    50% { opacity: 0.5; box-shadow: 0 0 12px #ff4466; }
  }

  .recording-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .stop-btn {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    background: none;
    border: none;
    color: #ff4466;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    padding: 0.375rem 0.75rem;
    border-radius: 6px;
    transition: background 150ms ease;
  }

  .stop-btn:hover {
    background: rgba(255, 68, 102, 0.1);
  }

  .level-meter {
    width: 60px;
    height: 4px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 2px;
    overflow: hidden;
  }

  .level-fill {
    height: 100%;
    background: #00ff88;
    border-radius: 2px;
    transition: width 50ms linear;
  }
</style>
