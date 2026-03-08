/**
 * Records audio from microphone input.
 * Independent from StemPlayer — captures mic input separately.
 */
export class Recorder {
  private ctx: AudioContext;
  private mediaRecorder: MediaRecorder | null = null;
  private analyser: AnalyserNode | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private _isRecording = false;
  private analyserData: Float32Array<ArrayBuffer> | null = null;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
  }

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const source = this.ctx.createMediaStreamSource(this.stream);

    // Analyser for level metering
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    source.connect(this.analyser);
    this.analyserData = new Float32Array(this.analyser.fftSize) as Float32Array<ArrayBuffer>;

    // MediaRecorder for capturing audio
    this.chunks = [];
    this.mediaRecorder = new MediaRecorder(this.stream);
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.mediaRecorder.start();
    this._isRecording = true;
  }

  stop(): Promise<Blob> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state !== 'recording') {
        resolve(new Blob([]));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: this.mediaRecorder?.mimeType ?? 'audio/webm' });
        this.cleanup();
        resolve(blob);
      };

      this.mediaRecorder.stop();
      this._isRecording = false;
    });
  }

  /** RMS level 0-1 for metering */
  getLevel(): number {
    if (!this.analyser || !this.analyserData) return 0;
    this.analyser.getFloatTimeDomainData(this.analyserData);
    let sum = 0;
    for (let i = 0; i < this.analyserData.length; i++) {
      sum += this.analyserData[i]! * this.analyserData[i]!;
    }
    return Math.sqrt(sum / this.analyserData.length);
  }

  get isRecording(): boolean {
    return this._isRecording;
  }

  private cleanup(): void {
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
      this.stream = null;
    }
    this.mediaRecorder = null;
    this.analyser = null;
    this._isRecording = false;
  }
}
