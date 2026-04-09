import { loadAudioBuffer } from './audio-loader.js';

interface StemState {
  buffer: AudioBuffer;
  source: AudioBufferSourceNode | null;
  gain: GainNode;
  eqLow: BiquadFilterNode;
  eqMid: BiquadFilterNode;
  eqHigh: BiquadFilterNode;
  panner: StereoPannerNode;
  reverbSend: GainNode;
  volume: number;
  muted: boolean;
  pan: number;
  eqSettings: { low: number; mid: number; high: number };
  reverbAmount: number;
}

export class StemPlayer {
  private ctx: AudioContext;
  private _ownsContext: boolean;
  private stems = new Map<string, StemState>();
  private _isPlaying = false;
  private _startTime = 0;
  private _offset = 0;
  private _duration = 0;

  // Shared reverb bus
  private _reverbConvolver: ConvolverNode | null = null;
  private _reverbMasterGain: GainNode;

  // Loop region
  private _loopStart: number | null = null;
  private _loopEnd: number | null = null;

  constructor(externalCtx?: AudioContext) {
    if (externalCtx) {
      this.ctx = externalCtx;
      this._ownsContext = false;
    } else {
      this.ctx = new AudioContext();
      this._ownsContext = true;
    }
    this._reverbMasterGain = this.ctx.createGain();
    this._reverbMasterGain.gain.value = 0.3;
    this._reverbMasterGain.connect(this.ctx.destination);
  }

  async loadStem(name: string, url: string): Promise<void> {
    const buffer = await loadAudioBuffer(this.ctx, url);

    // Signal chain: source → eqLow → eqMid → eqHigh → gain → panner → destination
    //                                                         panner → reverbSend → convolver → destination
    const eqLow = this.ctx.createBiquadFilter();
    eqLow.type = 'lowshelf';
    eqLow.frequency.value = 200;
    eqLow.gain.value = 0;

    const eqMid = this.ctx.createBiquadFilter();
    eqMid.type = 'peaking';
    eqMid.frequency.value = 1000;
    eqMid.Q.value = 1;
    eqMid.gain.value = 0;

    const eqHigh = this.ctx.createBiquadFilter();
    eqHigh.type = 'highshelf';
    eqHigh.frequency.value = 4000;
    eqHigh.gain.value = 0;

    const gain = this.ctx.createGain();
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = 0;

    const reverbSend = this.ctx.createGain();
    reverbSend.gain.value = 0;

    // Wire chain
    eqLow.connect(eqMid);
    eqMid.connect(eqHigh);
    eqHigh.connect(gain);
    gain.connect(panner);
    panner.connect(this.ctx.destination);

    // Reverb send (parallel wet path)
    panner.connect(reverbSend);
    if (this._reverbConvolver) {
      reverbSend.connect(this._reverbConvolver);
    }

    this.stems.set(name, {
      buffer,
      source: null,
      gain,
      eqLow,
      eqMid,
      eqHigh,
      panner,
      reverbSend,
      volume: 1,
      muted: false,
      pan: 0,
      eqSettings: { low: 0, mid: 0, high: 0 },
      reverbAmount: 0,
    });

    if (buffer.duration > this._duration) {
      this._duration = buffer.duration;
    }
  }

  play(offsetSeconds?: number): void {
    if (this._isPlaying) this.stopSources();

    const offset = offsetSeconds ?? this._offset;
    this._offset = offset;
    this._startTime = this.ctx.currentTime;

    for (const [, stem] of this.stems) {
      const source = this.ctx.createBufferSource();
      source.buffer = stem.buffer;
      source.connect(stem.eqLow);
      source.start(0, offset);
      stem.source = source;

      source.onended = () => {
        if (!this._isPlaying) return;
        // Loop support
        if (this._loopStart !== null && this._loopEnd !== null && this.currentTime >= this._loopEnd - 0.05) {
          this.play(this._loopStart);
          return;
        }
        if (this.currentTime >= this._duration - 0.1) {
          this.pause();
          this._offset = 0;
        }
      };
    }

    this._isPlaying = true;
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  pause(): void {
    if (!this._isPlaying) return;
    this._offset = this.currentTime;
    this.stopSources();
    this._isPlaying = false;
  }

  stop(): void {
    this.stopSources();
    this._isPlaying = false;
    this._offset = 0;
  }

  seek(seconds: number): void {
    const clamped = Math.max(0, Math.min(seconds, this._duration));
    if (this._isPlaying) {
      this.play(clamped);
    } else {
      this._offset = clamped;
    }
  }

  setVolume(stem: string, vol: number): void {
    const s = this.stems.get(stem);
    if (!s) return;
    s.volume = vol;
    if (!s.muted) s.gain.gain.value = vol;
  }

  mute(stem: string): void {
    const s = this.stems.get(stem);
    if (!s) return;
    s.muted = true;
    s.gain.gain.value = 0;
  }

  unmute(stem: string): void {
    const s = this.stems.get(stem);
    if (!s) return;
    s.muted = false;
    s.gain.gain.value = s.volume;
  }

  toggleMute(stem: string): void {
    const s = this.stems.get(stem);
    if (!s) return;
    if (s.muted) this.unmute(stem);
    else this.mute(stem);
  }

  solo(stem: string): void {
    for (const [name, s] of this.stems) {
      if (name === stem) {
        s.muted = false;
        s.gain.gain.value = s.volume;
      } else {
        s.muted = true;
        s.gain.gain.value = 0;
      }
    }
  }

  unsolo(): void {
    for (const [, s] of this.stems) {
      s.muted = false;
      s.gain.gain.value = s.volume;
    }
  }

  setPan(stem: string, value: number): void {
    const s = this.stems.get(stem);
    if (!s) return;
    s.pan = Math.max(-1, Math.min(1, value));
    s.panner.pan.value = s.pan;
  }

  setEq(stem: string, band: 'low' | 'mid' | 'high', gain: number): void {
    const s = this.stems.get(stem);
    if (!s) return;
    const clamped = Math.max(-12, Math.min(12, gain));
    s.eqSettings[band] = clamped;
    if (band === 'low') s.eqLow.gain.value = clamped;
    else if (band === 'mid') s.eqMid.gain.value = clamped;
    else s.eqHigh.gain.value = clamped;
  }

  setReverbSend(stem: string, amount: number): void {
    const s = this.stems.get(stem);
    if (!s) return;
    s.reverbAmount = Math.max(0, Math.min(1, amount));
    s.reverbSend.gain.value = s.reverbAmount;
  }

  async setReverbIR(buffer: AudioBuffer): Promise<void> {
    if (this._reverbConvolver) {
      this._reverbConvolver.disconnect();
    }
    this._reverbConvolver = this.ctx.createConvolver();
    this._reverbConvolver.buffer = buffer;
    this._reverbConvolver.connect(this._reverbMasterGain);

    // Reconnect all stems' reverb sends
    for (const [, stem] of this.stems) {
      stem.reverbSend.disconnect();
      stem.reverbSend.connect(this._reverbConvolver);
    }
  }

  setLoopRegion(start: number, end: number): void {
    this._loopStart = Math.max(0, start);
    this._loopEnd = Math.min(this._duration, end);
  }

  clearLoopRegion(): void {
    this._loopStart = null;
    this._loopEnd = null;
  }

  get loopStart(): number | null {
    return this._loopStart;
  }
  get loopEnd(): number | null {
    return this._loopEnd;
  }
  get isLooping(): boolean {
    return this._loopStart !== null && this._loopEnd !== null;
  }

  get currentTime(): number {
    if (!this._isPlaying) return this._offset;
    return this._offset + (this.ctx.currentTime - this._startTime);
  }

  get duration(): number {
    return this._duration;
  }

  get isPlaying(): boolean {
    return this._isPlaying;
  }

  getStemState(name: string):
    | {
        volume: number;
        muted: boolean;
        pan: number;
        eqSettings: { low: number; mid: number; high: number };
        reverbAmount: number;
      }
    | undefined {
    const s = this.stems.get(name);
    if (!s) return undefined;
    return {
      volume: s.volume,
      muted: s.muted,
      pan: s.pan,
      eqSettings: { ...s.eqSettings },
      reverbAmount: s.reverbAmount,
    };
  }

  getBuffer(name: string): AudioBuffer | undefined {
    return this.stems.get(name)?.buffer;
  }

  get stemNames(): string[] {
    return [...this.stems.keys()];
  }

  get audioContext(): AudioContext {
    return this.ctx;
  }

  destroy(): void {
    this.stopSources();
    if (this._reverbConvolver) this._reverbConvolver.disconnect();
    if (this._ownsContext) {
      void this.ctx.close();
    }
  }

  private stopSources(): void {
    for (const [, stem] of this.stems) {
      if (stem.source) {
        stem.source.onended = null;
        try {
          stem.source.stop();
        } catch {
          /* already stopped */
        }
        stem.source.disconnect();
        stem.source = null;
      }
    }
  }
}
