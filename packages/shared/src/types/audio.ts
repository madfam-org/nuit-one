export type AudioFormat = 'wav' | 'flac' | 'mp3' | 'ogg';

export type SampleRate = 44100 | 48000 | 96000;

export type BufferSize = 64 | 128 | 256 | 512 | 1024;

export interface AudioDeviceInfo {
  readonly id: string;
  readonly name: string;
  readonly kind: 'input' | 'output';
  readonly sampleRates: readonly SampleRate[];
  readonly channelCount: number;
}

export type AudioEngineState = 'uninitialized' | 'initializing' | 'running' | 'suspended' | 'error';

export interface AudioProcessingConfig {
  readonly sampleRate: SampleRate;
  readonly bufferSize: BufferSize;
  readonly channelCount: number;
  readonly enableMonitoring: boolean;
}
