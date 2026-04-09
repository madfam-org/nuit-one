import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAudioInputDevices } from './device-manager.js';

describe('getAudioInputDevices', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('filters to audioinput devices only', async () => {
    const mockTrack = { stop: vi.fn() };
    const mockStream = { getTracks: () => [mockTrack] };

    const mockDevices = [
      { kind: 'audioinput', deviceId: 'mic1', label: 'Built-in Mic', groupId: 'g1' },
      { kind: 'audiooutput', deviceId: 'spk1', label: 'Speakers', groupId: 'g2' },
      { kind: 'audioinput', deviceId: 'mic2', label: 'USB Mic', groupId: 'g3' },
      { kind: 'videoinput', deviceId: 'cam1', label: 'Camera', groupId: 'g4' },
    ];

    Object.defineProperty(globalThis, 'navigator', {
      value: {
        mediaDevices: {
          getUserMedia: vi.fn().mockResolvedValue(mockStream),
          enumerateDevices: vi.fn().mockResolvedValue(mockDevices),
        },
      },
      writable: true,
    });

    const devices = await getAudioInputDevices();

    expect(devices).toHaveLength(2);
    expect(devices[0]!.deviceId).toBe('mic1');
    expect(devices[1]!.deviceId).toBe('mic2');
  });

  it('generates fallback labels for devices without labels', async () => {
    const mockTrack = { stop: vi.fn() };
    const mockStream = { getTracks: () => [mockTrack] };

    const mockDevices = [{ kind: 'audioinput', deviceId: 'abcdef1234567890', label: '', groupId: 'g1' }];

    Object.defineProperty(globalThis, 'navigator', {
      value: {
        mediaDevices: {
          getUserMedia: vi.fn().mockResolvedValue(mockStream),
          enumerateDevices: vi.fn().mockResolvedValue(mockDevices),
        },
      },
      writable: true,
    });

    const devices = await getAudioInputDevices();

    expect(devices).toHaveLength(1);
    expect(devices[0]!.label).toBe('Input abcdef12');
  });

  it('stops temporary stream tracks after enumeration', async () => {
    const mockTrack = { stop: vi.fn() };
    const mockStream = { getTracks: () => [mockTrack] };

    Object.defineProperty(globalThis, 'navigator', {
      value: {
        mediaDevices: {
          getUserMedia: vi.fn().mockResolvedValue(mockStream),
          enumerateDevices: vi.fn().mockResolvedValue([]),
        },
      },
      writable: true,
    });

    await getAudioInputDevices();

    expect(mockTrack.stop).toHaveBeenCalledOnce();
  });
});
