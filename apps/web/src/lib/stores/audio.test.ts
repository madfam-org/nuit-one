import { get } from 'svelte/store';
import { describe, expect, it } from 'vitest';
import { type AudioState, audioState } from './audio';

describe('audioState store', () => {
  describe('initial state', () => {
    it('has engineState set to uninitialized', () => {
      const state = get(audioState);
      expect(state.engineState).toBe('uninitialized');
    });

    it('has sampleRate set to 44100', () => {
      const state = get(audioState);
      expect(state.sampleRate).toBe(44100);
    });

    it('has bufferSize set to 256', () => {
      const state = get(audioState);
      expect(state.bufferSize).toBe(256);
    });

    it('has inputDevice set to null', () => {
      const state = get(audioState);
      expect(state.inputDevice).toBeNull();
    });

    it('has outputDevice set to null', () => {
      const state = get(audioState);
      expect(state.outputDevice).toBeNull();
    });

    it('has inputLevel set to 0', () => {
      const state = get(audioState);
      expect(state.inputLevel).toBe(0);
    });

    it('matches the full expected default state', () => {
      const state = get(audioState);
      expect(state).toEqual({
        engineState: 'uninitialized',
        sampleRate: 44100,
        bufferSize: 256,
        inputDevice: null,
        outputDevice: null,
        inputLevel: 0,
      });
    });
  });

  describe('writability', () => {
    it('can update engineState to running', () => {
      audioState.update((s) => ({ ...s, engineState: 'running' }));
      const state = get(audioState);
      expect(state.engineState).toBe('running');
    });

    it('can update sampleRate', () => {
      audioState.update((s) => ({ ...s, sampleRate: 48000 }));
      const state = get(audioState);
      expect(state.sampleRate).toBe(48000);
    });

    it('can update bufferSize', () => {
      audioState.update((s) => ({ ...s, bufferSize: 512 }));
      const state = get(audioState);
      expect(state.bufferSize).toBe(512);
    });

    it('can set inputDevice', () => {
      audioState.update((s) => ({ ...s, inputDevice: 'built-in-mic' }));
      const state = get(audioState);
      expect(state.inputDevice).toBe('built-in-mic');
    });

    it('can set outputDevice', () => {
      audioState.update((s) => ({ ...s, outputDevice: 'headphones' }));
      const state = get(audioState);
      expect(state.outputDevice).toBe('headphones');
    });

    it('can update inputLevel', () => {
      audioState.update((s) => ({ ...s, inputLevel: 0.75 }));
      const state = get(audioState);
      expect(state.inputLevel).toBe(0.75);
    });

    it('can replace the entire state with set()', () => {
      const newState: AudioState = {
        engineState: 'suspended',
        sampleRate: 96000,
        bufferSize: 1024,
        inputDevice: 'usb-interface',
        outputDevice: 'studio-monitors',
        inputLevel: 0.5,
      };
      audioState.set(newState);
      expect(get(audioState)).toEqual(newState);
    });
  });

  describe('subscription', () => {
    it('notifies subscribers on update', () => {
      const values: AudioState[] = [];
      const unsubscribe = audioState.subscribe((state) => {
        values.push({ ...state });
      });

      audioState.update((s) => ({ ...s, engineState: 'initializing' }));
      audioState.update((s) => ({ ...s, engineState: 'running' }));

      // First value is the current state at subscribe time, then two updates
      expect(values.length).toBe(3);
      expect(values[1].engineState).toBe('initializing');
      expect(values[2].engineState).toBe('running');

      unsubscribe();
    });
  });
});
