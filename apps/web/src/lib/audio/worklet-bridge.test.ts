import { beforeEach, describe, expect, it } from 'vitest';
import { WorkletBridge } from './worklet-bridge';

describe('WorkletBridge', () => {
  let bridge: WorkletBridge;

  beforeEach(() => {
    bridge = new WorkletBridge();
  });

  describe('construction', () => {
    it('can be instantiated', () => {
      expect(bridge).toBeInstanceOf(WorkletBridge);
    });

    it('has initial state of uninitialized', () => {
      expect(bridge.state).toBe('uninitialized');
    });
  });

  describe('connectSource', () => {
    it('throws when bridge is not initialized', () => {
      // Create a minimal stand-in for MediaStreamAudioSourceNode.
      // The method checks for null context/workletNode before using the source,
      // so this will trigger the guard clause regardless of the source shape.
      const fakeSource = {} as MediaStreamAudioSourceNode;

      expect(() => bridge.connectSource(fakeSource)).toThrow('WorkletBridge not initialized');
    });
  });

  describe('destroy', () => {
    it('does not throw when called on an uninitialized bridge', async () => {
      await expect(bridge.destroy()).resolves.toBeUndefined();
    });

    it('resets state to uninitialized after destroy', async () => {
      await bridge.destroy();
      expect(bridge.state).toBe('uninitialized');
    });
  });

  describe('resume', () => {
    it('does nothing when context is null (not initialized)', async () => {
      // resume() checks this.context?.state, which is null before init.
      // It should complete without error and leave state unchanged.
      await expect(bridge.resume()).resolves.toBeUndefined();
      expect(bridge.state).toBe('uninitialized');
    });
  });

  describe('suspend', () => {
    it('does nothing when context is null (not initialized)', async () => {
      // suspend() checks this.context?.state, which is null before init.
      // It should complete without error and leave state unchanged.
      await expect(bridge.suspend()).resolves.toBeUndefined();
      expect(bridge.state).toBe('uninitialized');
    });
  });

  describe('initialize', () => {
    it('throws in a non-browser environment (no AudioContext)', async () => {
      // In vitest (Node), AudioContext is not available.
      // initialize() sets state to 'initializing' then attempts new AudioContext(),
      // which should fail, setting state to 'error'.
      await expect(bridge.initialize()).rejects.toThrow();
      expect(bridge.state).toBe('error');
    });

    it('sets state to error when initialization fails', async () => {
      try {
        await bridge.initialize(48000);
      } catch {
        // Expected to throw in Node environment
      }
      expect(bridge.state).toBe('error');
    });
  });

  describe('state getter', () => {
    it('is read-only (no public setter)', () => {
      // The state property is exposed via a getter with no setter.
      // Attempting to assign directly should have no effect or throw in strict mode.
      const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(bridge), 'state');
      expect(descriptor).toBeDefined();
      expect(descriptor!.get).toBeDefined();
      expect(descriptor!.set).toBeUndefined();
    });
  });
});
