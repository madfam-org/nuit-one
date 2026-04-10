import type { InputSource } from './input-source.js';

/**
 * MIDI controller input source for real-time note detection.
 * Implements InputSource so it can be used interchangeably with PitchDetector.
 */
export class MidiInput implements InputSource {
  private _currentMidiNote = -1;
  private _currentVelocity = 0;
  private _running = false;
  private midiAccess: MIDIAccess | null = null;
  private selectedInput: MIDIInput | null = null;
  private noteHoldTimeout: ReturnType<typeof setTimeout> | null = null;

  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function';
  }

  async start(deviceId?: string): Promise<void> {
    this.midiAccess = await navigator.requestMIDIAccess();

    if (deviceId) {
      this.selectedInput = this.midiAccess.inputs.get(deviceId) ?? null;
    } else {
      // Use first available input
      const inputs = Array.from(this.midiAccess.inputs.values());
      this.selectedInput = inputs[0] ?? null;
    }

    if (!this.selectedInput) {
      throw new Error('No MIDI input device found');
    }

    this.selectedInput.onmidimessage = (event: MIDIMessageEvent) => this.onMidiMessage(event);
    this._running = true;
  }

  stop(): void {
    if (this.selectedInput) {
      this.selectedInput.onmidimessage = null;
    }
    if (this.noteHoldTimeout) {
      clearTimeout(this.noteHoldTimeout);
      this.noteHoldTimeout = null;
    }
    this._running = false;
    this._currentMidiNote = -1;
    this._currentVelocity = 0;
    this.selectedInput = null;
    this.midiAccess = null;
  }

  private onMidiMessage(event: MIDIMessageEvent): void {
    const data = event.data;
    if (!data || data.length < 3) return;

    const status = data[0]! & 0xf0; // Strip channel nibble
    const note = data[1]!;
    const velocity = data[2]!;

    if (status === 0x90 && velocity > 0) {
      // Note On
      this._currentMidiNote = note;
      this._currentVelocity = velocity;

      // Hold the note for 50ms so RAF-based scoring doesn't miss it
      if (this.noteHoldTimeout) clearTimeout(this.noteHoldTimeout);
      this.noteHoldTimeout = setTimeout(() => {
        this._currentMidiNote = -1;
        this._currentVelocity = 0;
        this.noteHoldTimeout = null;
      }, 50);
    } else if (status === 0x80 || (status === 0x90 && velocity === 0)) {
      // Note Off — don't clear immediately (let the hold timeout handle it)
      // But if the timeout already fired, clear now
      if (this._currentMidiNote === note && !this.noteHoldTimeout) {
        this._currentMidiNote = -1;
        this._currentVelocity = 0;
      }
    }
  }

  get currentMidiNote(): number {
    return this._currentMidiNote;
  }
  get currentAmplitude(): number {
    return this._currentVelocity;
  }
  get running(): boolean {
    return this._running;
  }
}
