/**
 * Latency calibration wizard.
 * Measures output, input, and display latency for accurate note synchronization.
 */
export class CalibrationWizard {
  private ctx: AudioContext;
  private measurements: number[] = [];

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
  }

  /**
   * Measure output latency by scheduling a click and measuring when it fires.
   * Returns median of several measurements in ms.
   */
  async measureOutputLatency(rounds = 5): Promise<number> {
    this.measurements = [];

    for (let i = 0; i < rounds; i++) {
      const latency = await this.singleOutputMeasurement();
      this.measurements.push(latency);
      await sleep(200);
    }

    return this.getMedian();
  }

  /**
   * Measure input latency via loopback test.
   * Plays a click and listens for it via the microphone.
   * Requires speakers + mic in close proximity.
   */
  async measureInputLatency(rounds = 5): Promise<number> {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const source = this.ctx.createMediaStreamSource(stream);
    const analyser = this.ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    this.measurements = [];
    const data = new Float32Array(analyser.fftSize) as Float32Array<ArrayBuffer>;

    for (let i = 0; i < rounds; i++) {
      const sendTime = this.ctx.currentTime;

      // Play click
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.frequency.value = 1000;
      gain.gain.value = 0.8;
      gain.gain.exponentialRampToValueAtTime(0.001, sendTime + 0.005);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(sendTime);
      osc.stop(sendTime + 0.005);

      // Listen for detection
      const detected = await waitForThreshold(analyser, data, 0.1, 500);
      if (detected !== null) {
        this.measurements.push((detected - sendTime) * 1000);
      }

      await sleep(300);
    }

    // Cleanup
    for (const track of stream.getTracks()) track.stop();

    return this.getMedian();
  }

  /**
   * Measure display/rendering latency.
   * Uses requestAnimationFrame timing as a proxy.
   */
  async measureDisplayLatency(rounds = 10): Promise<number> {
    this.measurements = [];

    for (let i = 0; i < rounds; i++) {
      const before = performance.now();
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const after = performance.now();
      this.measurements.push(after - before);
    }

    return this.getMedian();
  }

  getMedian(): number {
    if (this.measurements.length === 0) return 0;
    const sorted = [...this.measurements].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
  }

  private async singleOutputMeasurement(): Promise<number> {
    return new Promise<number>((resolve) => {
      const before = performance.now();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.onended = () => {
        resolve(performance.now() - before);
      };
      osc.start();
      osc.stop(this.ctx.currentTime + 0.001);
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForThreshold(
  analyser: AnalyserNode,
  data: Float32Array<ArrayBuffer>,
  threshold: number,
  timeoutMs: number,
): Promise<number | null> {
  const ctx = analyser.context as AudioContext;
  const startTime = performance.now();

  return new Promise((resolve) => {
    function check() {
      if (performance.now() - startTime > timeoutMs) {
        resolve(null);
        return;
      }
      analyser.getFloatTimeDomainData(data);
      let rms = 0;
      for (let i = 0; i < data.length; i++) {
        rms += data[i]! * data[i]!;
      }
      rms = Math.sqrt(rms / data.length);

      if (rms > threshold) {
        resolve(ctx.currentTime);
        return;
      }
      requestAnimationFrame(check);
    }
    requestAnimationFrame(check);
  });
}
