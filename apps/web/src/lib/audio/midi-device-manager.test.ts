import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMidiInputDevices, isMidiSupported } from './midi-device-manager.js';

describe('isMidiSupported', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns true when requestMIDIAccess is available', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { requestMIDIAccess: vi.fn() },
      writable: true,
    });

    expect(isMidiSupported()).toBe(true);
  });

  it('returns false when navigator is undefined', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: undefined,
      writable: true,
    });

    expect(isMidiSupported()).toBe(false);
  });

  it('returns false when requestMIDIAccess is not present', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { mediaDevices: {} },
      writable: true,
    });

    expect(isMidiSupported()).toBe(false);
  });
});

describe('getMidiInputDevices', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns empty array when MIDI is not supported', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: undefined,
      writable: true,
    });

    const devices = await getMidiInputDevices();
    expect(devices).toEqual([]);
  });

  it('returns available MIDI input devices', async () => {
    const mockInputs = new Map([
      ['id-1', { id: 'id-1', name: 'MIDI Keyboard', manufacturer: 'Yamaha' }],
      ['id-2', { id: 'id-2', name: 'Drum Pad', manufacturer: 'Akai' }],
    ]);
    const mockAccess = { inputs: mockInputs };

    Object.defineProperty(globalThis, 'navigator', {
      value: { requestMIDIAccess: vi.fn().mockResolvedValue(mockAccess) },
      writable: true,
    });

    const devices = await getMidiInputDevices();

    expect(devices).toHaveLength(2);
    expect(devices[0]?.id).toBe('id-1');
    expect(devices[0]?.name).toBe('MIDI Keyboard');
    expect(devices[0]?.manufacturer).toBe('Yamaha');
    expect(devices[1]?.id).toBe('id-2');
    expect(devices[1]?.name).toBe('Drum Pad');
    expect(devices[1]?.manufacturer).toBe('Akai');
  });

  it('uses fallback name for devices without name', async () => {
    const mockInputs = new Map([
      ['id-1', { id: 'id-1', name: null, manufacturer: '' }],
    ]);
    const mockAccess = { inputs: mockInputs };

    Object.defineProperty(globalThis, 'navigator', {
      value: { requestMIDIAccess: vi.fn().mockResolvedValue(mockAccess) },
      writable: true,
    });

    const devices = await getMidiInputDevices();

    expect(devices).toHaveLength(1);
    expect(devices[0]?.name).toBe('Unknown MIDI Device');
    expect(devices[0]?.manufacturer).toBe('');
  });

  it('returns empty array when requestMIDIAccess rejects', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { requestMIDIAccess: vi.fn().mockRejectedValue(new Error('Permission denied')) },
      writable: true,
    });

    const devices = await getMidiInputDevices();
    expect(devices).toEqual([]);
  });

  it('returns empty array when no inputs are connected', async () => {
    const mockInputs = new Map();
    const mockAccess = { inputs: mockInputs };

    Object.defineProperty(globalThis, 'navigator', {
      value: { requestMIDIAccess: vi.fn().mockResolvedValue(mockAccess) },
      writable: true,
    });

    const devices = await getMidiInputDevices();
    expect(devices).toEqual([]);
  });
});
