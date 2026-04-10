import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MidiInput } from './midi-input.js';

describe('MidiInput.isSupported', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns true when requestMIDIAccess is available', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { requestMIDIAccess: vi.fn() },
      writable: true,
    });

    expect(MidiInput.isSupported()).toBe(true);
  });

  it('returns false when navigator is undefined', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: undefined,
      writable: true,
    });

    expect(MidiInput.isSupported()).toBe(false);
  });

  it('returns false when requestMIDIAccess is not a function', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { requestMIDIAccess: undefined },
      writable: true,
    });

    expect(MidiInput.isSupported()).toBe(false);
  });
});

describe('MidiInput lifecycle', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default values', () => {
    const midi = new MidiInput();
    expect(midi.currentMidiNote).toBe(-1);
    expect(midi.currentAmplitude).toBe(0);
    expect(midi.running).toBe(false);
  });

  it('starts with the first available input when no deviceId specified', async () => {
    const mockInput = { id: 'input-1', onmidimessage: null };
    const mockInputsMap = new Map([['input-1', mockInput]]);
    const mockAccess = { inputs: mockInputsMap };

    Object.defineProperty(globalThis, 'navigator', {
      value: { requestMIDIAccess: vi.fn().mockResolvedValue(mockAccess) },
      writable: true,
    });

    const midi = new MidiInput();
    await midi.start();

    expect(midi.running).toBe(true);
    expect(mockInput.onmidimessage).not.toBeNull();
  });

  it('starts with a specific device when deviceId is provided', async () => {
    const mockInput1 = { id: 'input-1', onmidimessage: null };
    const mockInput2 = { id: 'input-2', onmidimessage: null };
    const mockInputsMap = new Map([
      ['input-1', mockInput1],
      ['input-2', mockInput2],
    ]);
    const mockAccess = { inputs: mockInputsMap };

    Object.defineProperty(globalThis, 'navigator', {
      value: { requestMIDIAccess: vi.fn().mockResolvedValue(mockAccess) },
      writable: true,
    });

    const midi = new MidiInput();
    await midi.start('input-2');

    expect(midi.running).toBe(true);
    expect(mockInput2.onmidimessage).not.toBeNull();
    expect(mockInput1.onmidimessage).toBeNull();
  });

  it('throws when no MIDI input device is found', async () => {
    const mockInputsMap = new Map();
    const mockAccess = { inputs: mockInputsMap };

    Object.defineProperty(globalThis, 'navigator', {
      value: { requestMIDIAccess: vi.fn().mockResolvedValue(mockAccess) },
      writable: true,
    });

    const midi = new MidiInput();
    await expect(midi.start()).rejects.toThrow('No MIDI input device found');
  });

  it('stops cleanly and resets state', async () => {
    const mockInput = { id: 'input-1', onmidimessage: null };
    const mockInputsMap = new Map([['input-1', mockInput]]);
    const mockAccess = { inputs: mockInputsMap };

    Object.defineProperty(globalThis, 'navigator', {
      value: { requestMIDIAccess: vi.fn().mockResolvedValue(mockAccess) },
      writable: true,
    });

    const midi = new MidiInput();
    await midi.start();
    expect(midi.running).toBe(true);

    midi.stop();
    expect(midi.running).toBe(false);
    expect(midi.currentMidiNote).toBe(-1);
    expect(midi.currentAmplitude).toBe(0);
    expect(mockInput.onmidimessage).toBeNull();
  });
});

describe('MidiInput message parsing', () => {
  let midi: MidiInput;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockInput: any;

  beforeEach(async () => {
    vi.useFakeTimers();
    mockInput = { id: 'input-1', onmidimessage: null };
    const mockInputsMap = new Map([['input-1', mockInput]]);
    const mockAccess = { inputs: mockInputsMap };

    Object.defineProperty(globalThis, 'navigator', {
      value: { requestMIDIAccess: vi.fn().mockResolvedValue(mockAccess) },
      writable: true,
    });

    midi = new MidiInput();
    await midi.start();
  });

  afterEach(() => {
    midi.stop();
    vi.useRealTimers();
  });

  function sendMidiMessage(bytes: number[]) {
    const event = { data: new Uint8Array(bytes) } as unknown as MIDIMessageEvent;
    mockInput.onmidimessage(event);
  }

  it('detects Note On messages (status 0x90 with velocity > 0)', () => {
    sendMidiMessage([0x90, 60, 100]); // C4, velocity 100

    expect(midi.currentMidiNote).toBe(60);
    expect(midi.currentAmplitude).toBe(100);
  });

  it('treats Note On with velocity 0 as Note Off', () => {
    sendMidiMessage([0x90, 60, 100]); // Note On
    vi.advanceTimersByTime(60); // Let hold timeout expire
    sendMidiMessage([0x90, 60, 0]); // Note Off (velocity 0)

    expect(midi.currentMidiNote).toBe(-1);
    expect(midi.currentAmplitude).toBe(0);
  });

  it('detects Note Off messages (status 0x80)', () => {
    sendMidiMessage([0x90, 60, 100]); // Note On
    vi.advanceTimersByTime(60); // Let hold timeout expire
    sendMidiMessage([0x80, 60, 0]); // Note Off

    expect(midi.currentMidiNote).toBe(-1);
    expect(midi.currentAmplitude).toBe(0);
  });

  it('holds note for 50ms so RAF-based scoring can read it', () => {
    sendMidiMessage([0x90, 64, 80]); // E4, velocity 80

    // Note should still be held immediately
    expect(midi.currentMidiNote).toBe(64);
    expect(midi.currentAmplitude).toBe(80);

    // After 30ms, still held
    vi.advanceTimersByTime(30);
    expect(midi.currentMidiNote).toBe(64);

    // After 50ms total, cleared
    vi.advanceTimersByTime(20);
    expect(midi.currentMidiNote).toBe(-1);
    expect(midi.currentAmplitude).toBe(0);
  });

  it('replaces previous note when a new Note On arrives during hold', () => {
    sendMidiMessage([0x90, 60, 100]); // C4
    expect(midi.currentMidiNote).toBe(60);

    sendMidiMessage([0x90, 64, 90]); // E4 (replaces C4)
    expect(midi.currentMidiNote).toBe(64);
    expect(midi.currentAmplitude).toBe(90);
  });

  it('strips MIDI channel from status byte', () => {
    // Note On on channel 5 (0x94)
    sendMidiMessage([0x94, 72, 110]);
    expect(midi.currentMidiNote).toBe(72);

    vi.advanceTimersByTime(60);

    // Note Off on channel 5 (0x84)
    sendMidiMessage([0x84, 72, 0]);
    expect(midi.currentMidiNote).toBe(-1);
  });

  it('ignores messages shorter than 3 bytes', () => {
    sendMidiMessage([0x90, 60]); // Only 2 bytes
    expect(midi.currentMidiNote).toBe(-1);
  });

  it('ignores messages with null data', () => {
    const event = { data: null } as unknown as MIDIMessageEvent;
    mockInput.onmidimessage(event);
    expect(midi.currentMidiNote).toBe(-1);
  });
});
