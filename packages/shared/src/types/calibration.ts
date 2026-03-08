import type { BufferSize, SampleRate } from './audio.js';

export interface CalibrationProfile {
  readonly id: string;
  readonly userId: string;
  readonly deviceName: string;
  /** Input latency in milliseconds */
  readonly inputLatencyMs: number;
  /** Output latency in milliseconds */
  readonly outputLatencyMs: number;
  /** Display latency in milliseconds */
  readonly displayLatencyMs: number;
  readonly bufferSize: BufferSize;
  readonly sampleRate: SampleRate;
  readonly isActive: boolean;
  readonly createdAt: string;
}

export type CalibrationStep = 'audio_output' | 'audio_input' | 'display' | 'complete';

export interface CalibrationState {
  readonly currentStep: CalibrationStep;
  readonly measurements: readonly number[];
  readonly deviceName: string;
}
