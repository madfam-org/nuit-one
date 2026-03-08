import { writable } from 'svelte/store';

export interface AudioState {
  engineState: 'uninitialized' | 'initializing' | 'running' | 'suspended' | 'error';
  sampleRate: number;
  bufferSize: number;
  inputDevice: string | null;
  outputDevice: string | null;
  inputLevel: number;
}

export const audioState = writable<AudioState>({
  engineState: 'uninitialized',
  sampleRate: 44100,
  bufferSize: 256,
  inputDevice: null,
  outputDevice: null,
  inputLevel: 0,
});
