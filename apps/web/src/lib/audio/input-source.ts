export interface InputSource {
  readonly currentMidiNote: number;
  readonly currentAmplitude: number;
  readonly running: boolean;
  start(...args: unknown[]): Promise<void>;
  stop(): void;
}

export type InputType = 'microphone' | 'midi';
