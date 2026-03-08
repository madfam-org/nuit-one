import { loadAudioBuffer } from './audio-loader.js';

interface StemState {
  buffer: AudioBuffer;
  source: AudioBufferSourceNode | null;
  gain: GainNode;
  volume: number;
  muted: boolean;
}

export class StemPlayer {
  private ctx: AudioContext;
  private stems = new Map<string, StemState>();
  private _isPlaying = false;
  private _startTime = 0; // AudioContext time when playback started
  private _offset = 0; // Track position offset in seconds
  private _duration = 0;

  constructor() {
    this.ctx = new AudioContext();
  }

  async loadStem(name: string, url: string): Promise<void> {
    const buffer = await loadAudioBuffer(this.ctx, url);
    const gain = this.ctx.createGain();
    gain.connect(this.ctx.destination);

    this.stems.set(name, {
      buffer,
      source: null,
      gain,
      volume: 1,
      muted: false,
    });

    // Track duration from longest stem
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
      source.connect(stem.gain);
      source.start(0, offset);
      stem.source = source;

      // Handle playback end
      source.onended = () => {
        if (this._isPlaying && this.currentTime >= this._duration - 0.1) {
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

  getStemState(name: string): { volume: number; muted: boolean } | undefined {
    const s = this.stems.get(name);
    if (!s) return undefined;
    return { volume: s.volume, muted: s.muted };
  }

  get stemNames(): string[] {
    return [...this.stems.keys()];
  }

  get audioContext(): AudioContext {
    return this.ctx;
  }

  destroy(): void {
    this.stopSources();
    void this.ctx.close();
  }

  private stopSources(): void {
    for (const [, stem] of this.stems) {
      if (stem.source) {
        stem.source.onended = null;
        try { stem.source.stop(); } catch { /* already stopped */ }
        stem.source.disconnect();
        stem.source = null;
      }
    }
  }
}
