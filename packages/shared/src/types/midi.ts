export interface MidiNote {
  /** MIDI pitch value (0-127) */
  readonly pitch: number;
  /** MIDI velocity value (0-127) */
  readonly velocity: number;
  /** Start time in seconds */
  readonly startTime: number;
  /** Duration in seconds */
  readonly duration: number;
  /** MIDI channel (0-15) */
  readonly channel: number;
}

export type MidiEvent =
  | { readonly type: 'note_on'; readonly pitch: number; readonly velocity: number; readonly channel: number }
  | { readonly type: 'note_off'; readonly pitch: number; readonly velocity: number; readonly channel: number }
  | { readonly type: 'control_change'; readonly controller: number; readonly value: number; readonly channel: number }
  | { readonly type: 'pitch_bend'; readonly value: number; readonly channel: number };

export interface MidiTrack {
  readonly name: string;
  readonly notes: readonly MidiNote[];
  readonly events: readonly MidiEvent[];
  readonly instrument: string;
}
