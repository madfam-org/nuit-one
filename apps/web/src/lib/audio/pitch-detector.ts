export interface PitchDetectorOptions {
  minFrequency?: number;
  maxFrequency?: number;
  deviceId?: string;
}

/**
 * Real-time pitch detection using autocorrelation (YIN-inspired).
 * Detects the fundamental frequency from microphone/line input.
 */
export class PitchDetector {
  private ctx: AudioContext;
  private analyser: AnalyserNode;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private buffer: Float32Array<ArrayBuffer>;
  private _running = false;
  private _currentPitch = 0;
  private _currentMidiNote = -1;
  private _confidence = 0;
  private _rms = 0;
  private rafId: number | null = null;
  private minFreq: number;
  private maxFreq: number;
  private deviceId: string | undefined;

  constructor(audioContext: AudioContext, options?: PitchDetectorOptions) {
    this.ctx = audioContext;
    this.minFreq = options?.minFrequency ?? 30;
    this.maxFreq = options?.maxFrequency ?? 500;
    this.deviceId = options?.deviceId;
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 4096;
    this.buffer = new Float32Array(this.analyser.fftSize) as Float32Array<ArrayBuffer>;
  }

  async start(): Promise<void> {
    const constraints: MediaTrackConstraints = {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    };
    if (this.deviceId) {
      constraints.deviceId = { exact: this.deviceId };
    }
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: constraints,
    });

    this.source = this.ctx.createMediaStreamSource(this.stream);
    this.source.connect(this.analyser);
    this._running = true;
    this.detect();
  }

  stop(): void {
    this._running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.source?.disconnect();
    this.stream?.getTracks().forEach((t) => {
      t.stop();
    });
    this.stream = null;
    this.source = null;
  }

  private detect(): void {
    if (!this._running) return;

    this.analyser.getFloatTimeDomainData(this.buffer);

    // Check if there's enough signal
    let rms = 0;
    for (let i = 0; i < this.buffer.length; i++) {
      rms += this.buffer[i]! * this.buffer[i]!;
    }
    rms = Math.sqrt(rms / this.buffer.length);
    this._rms = rms;

    if (rms < 0.01) {
      // Too quiet — no pitch detected
      this._currentPitch = 0;
      this._currentMidiNote = -1;
      this._confidence = 0;
    } else {
      const result = this.autocorrelate();
      if (result.frequency > 0) {
        this._currentPitch = result.frequency;
        this._currentMidiNote = frequencyToMidi(result.frequency);
        this._confidence = result.confidence;
      } else {
        this._currentPitch = 0;
        this._currentMidiNote = -1;
        this._confidence = 0;
      }
    }

    this.rafId = requestAnimationFrame(() => this.detect());
  }

  private autocorrelate(): { frequency: number; confidence: number } {
    const buf = this.buffer;
    const n = buf.length;
    const sampleRate = this.ctx.sampleRate;

    // Find first zero crossing
    let start = 0;
    for (let i = 0; i < n / 2; i++) {
      if (buf[i]! < 0 && buf[i + 1]! >= 0) {
        start = i;
        break;
      }
    }

    // Autocorrelation
    let bestOffset = -1;
    let bestCorrelation = 0;
    const minPeriod = Math.floor(sampleRate / this.maxFreq);
    const maxPeriod = Math.floor(sampleRate / this.minFreq);

    for (let offset = minPeriod; offset < maxPeriod && offset < n / 2; offset++) {
      let correlation = 0;
      let norm1 = 0;
      let norm2 = 0;

      for (let i = start; i < n / 2; i++) {
        correlation += buf[i]! * buf[i + offset]!;
        norm1 += buf[i]! * buf[i]!;
        norm2 += buf[i + offset]! * buf[i + offset]!;
      }

      const normFactor = Math.sqrt(norm1 * norm2);
      if (normFactor === 0) continue;
      correlation /= normFactor;

      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestOffset = offset;
      }
    }

    if (bestCorrelation > 0.5 && bestOffset > 0) {
      return {
        frequency: sampleRate / bestOffset,
        confidence: bestCorrelation,
      };
    }

    return { frequency: 0, confidence: 0 };
  }

  get currentPitch(): number {
    return this._currentPitch;
  }
  get currentMidiNote(): number {
    return this._currentMidiNote;
  }
  get confidence(): number {
    return this._confidence;
  }
  get running(): boolean {
    return this._running;
  }
  /** Current RMS amplitude mapped to MIDI velocity (0-127) */
  get currentAmplitude(): number {
    // Map RMS (typically 0-0.5 for microphone input) to 0-127
    // Clamp to prevent overflow
    return Math.min(127, Math.round(this._rms * 254));
  }
}

/** Convert frequency in Hz to nearest MIDI note number */
export function frequencyToMidi(freq: number): number {
  if (freq <= 0) return -1;
  return Math.round(12 * Math.log2(freq / 440) + 69);
}

/** Convert MIDI note number to frequency in Hz */
export function midiToFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** Get note name from MIDI note number */
export function midiToNoteName(midi: number): string {
  if (midi < 0) return '';
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const note = names[midi % 12]!;
  const octave = Math.floor(midi / 12) - 1;
  return `${note}${octave}`;
}
