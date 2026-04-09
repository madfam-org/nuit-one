import { describe, expect, it } from 'vitest';
import { WORKLET_PROCESSOR_SOURCE } from './worklet-processor';

describe('WORKLET_PROCESSOR_SOURCE', () => {
  it('is exported and is a non-empty string', () => {
    expect(typeof WORKLET_PROCESSOR_SOURCE).toBe('string');
    expect(WORKLET_PROCESSOR_SOURCE.length).toBeGreaterThan(0);
  });

  it('contains a registerProcessor call', () => {
    expect(WORKLET_PROCESSOR_SOURCE).toContain('registerProcessor');
  });

  it('contains the NuitAudioProcessor class name', () => {
    expect(WORKLET_PROCESSOR_SOURCE).toContain('NuitAudioProcessor');
  });

  it('contains the process method', () => {
    expect(WORKLET_PROCESSOR_SOURCE).toContain('process(inputs, outputs');
  });

  it('contains a message handler for the init type', () => {
    expect(WORKLET_PROCESSOR_SOURCE).toContain("case 'init'");
  });

  it('contains a message handler for the stop type', () => {
    expect(WORKLET_PROCESSOR_SOURCE).toContain("case 'stop'");
  });
});
