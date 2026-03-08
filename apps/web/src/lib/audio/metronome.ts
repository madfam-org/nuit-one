/**
 * Metronome using Web Audio API "look-ahead scheduler" pattern.
 * Generates OscillatorNode clicks synced to tempo.
 */
export class Metronome {
  private ctx: AudioContext;
  private _tempo = 120;
  private _isRunning = false;
  private _currentBeat = 0;
  private _beatsPerMeasure = 4;
  private nextNoteTime = 0;
  private scheduleIntervalId: ReturnType<typeof setInterval> | null = null;
  private readonly scheduleAheadTime = 0.1; // seconds
  private readonly lookahead = 25; // ms

  constructor(ctx: AudioContext, tempo = 120, beatsPerMeasure = 4) {
    this.ctx = ctx;
    this._tempo = tempo;
    this._beatsPerMeasure = beatsPerMeasure;
  }

  start(startTime?: number): void {
    if (this._isRunning) return;
    this._isRunning = true;
    this._currentBeat = 0;
    this.nextNoteTime = startTime ?? this.ctx.currentTime;
    this.scheduleIntervalId = setInterval(() => this.scheduler(), this.lookahead);
  }

  stop(): void {
    this._isRunning = false;
    if (this.scheduleIntervalId !== null) {
      clearInterval(this.scheduleIntervalId);
      this.scheduleIntervalId = null;
    }
  }

  set tempo(bpm: number) {
    this._tempo = Math.max(20, Math.min(300, bpm));
  }

  get tempo(): number {
    return this._tempo;
  }

  set beatsPerMeasure(beats: number) {
    this._beatsPerMeasure = beats;
  }

  get currentBeat(): number {
    return this._currentBeat;
  }

  get isRunning(): boolean {
    return this._isRunning;
  }

  private scheduler(): void {
    while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
      this.scheduleClick(this.nextNoteTime, this._currentBeat === 0);
      this.advance();
    }
  }

  private scheduleClick(time: number, isDownbeat: boolean): void {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = isDownbeat ? 880 : 440;

    gain.gain.value = 0.5;
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.01);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(time);
    osc.stop(time + 0.01);
  }

  private advance(): void {
    const secondsPerBeat = 60 / this._tempo;
    this.nextNoteTime += secondsPerBeat;
    this._currentBeat = (this._currentBeat + 1) % this._beatsPerMeasure;
  }
}
