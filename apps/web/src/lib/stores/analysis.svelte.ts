import type { ChordEvent, DifficultyTier } from '@nuit-one/shared';
import { WorkerManager } from '$lib/ai/worker-manager.js';

export type AnalysisStatus = 'idle' | 'running' | 'complete' | 'error';

interface AnalysisWorkerResult {
  id: string;
  chords: ChordEvent[];
  key: string;
  keyConfidence: number;
  bpm: number;
}

export function createAnalysisStore() {
  let status = $state<AnalysisStatus>('idle');
  let progress = $state(0);
  let chords = $state<ChordEvent[]>([]);
  let key = $state<string | null>(null);
  let keyConfidence = $state(0);
  let bpm = $state<number | null>(null);
  let difficultyTier = $state<DifficultyTier | null>(null);
  let errorMessage = $state<string | null>(null);

  let workerManager: WorkerManager | null = null;

  return {
    get status() { return status; },
    get progress() { return progress; },
    get chords() { return chords; },
    get key() { return key; },
    get keyConfidence() { return keyConfidence; },
    get bpm() { return bpm; },
    get difficultyTier() { return difficultyTier; },
    get errorMessage() { return errorMessage; },

    async analyze(audioBuffer: AudioBuffer) {
      status = 'running';
      progress = 0;
      errorMessage = null;

      try {
        // Get mono samples
        const channelData = audioBuffer.getChannelData(0);
        const samples = new Float32Array(channelData.length);
        samples.set(channelData);

        // Run in web worker
        workerManager = new WorkerManager('/workers/analysis-worker.js');
        const result = await workerManager.run<AnalysisWorkerResult>(
          'analyze',
          {
            audioData: samples.buffer,
            sampleRate: audioBuffer.sampleRate,
          },
          [samples.buffer],
          (p) => { progress = p; },
        );

        chords = result.chords;
        key = result.key;
        keyConfidence = result.keyConfidence;
        bpm = result.bpm;
        status = 'complete';
        progress = 1;
      } catch (err) {
        status = 'error';
        errorMessage = err instanceof Error ? err.message : 'Analysis failed';
      }
    },

    setDifficulty(tier: DifficultyTier) {
      difficultyTier = tier;
    },

    loadFromServer(data: {
      chords?: ChordEvent[] | null;
      key?: string | null;
      bpmDetected?: number | null;
      difficultyTier?: DifficultyTier | null;
    }) {
      if (data.chords) chords = data.chords;
      if (data.key) key = data.key;
      if (data.bpmDetected) bpm = data.bpmDetected;
      if (data.difficultyTier) difficultyTier = data.difficultyTier;
      if (data.chords || data.key || data.bpmDetected) {
        status = 'complete';
        progress = 1;
      }
    },

    async persist(trackId: string) {
      await fetch('/api/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackId,
          key,
          bpmDetected: bpm,
          chords,
          difficultyTier,
          analysisVersion: 'client-v1',
        }),
      });
    },

    reset() {
      status = 'idle';
      progress = 0;
      chords = [];
      key = null;
      keyConfidence = 0;
      bpm = null;
      difficultyTier = null;
      errorMessage = null;
      workerManager?.terminate();
      workerManager = null;
    },
  };
}

export type AnalysisStore = ReturnType<typeof createAnalysisStore>;
