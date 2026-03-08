/**
 * Bridge between the main thread and AudioWorklet processor.
 * Manages AudioContext lifecycle, WorkletNode registration, and message passing.
 */
export class WorkletBridge {
  private context: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private _state: 'uninitialized' | 'initializing' | 'running' | 'suspended' | 'error' = 'uninitialized';

  get state() {
    return this._state;
  }

  async initialize(sampleRate = 44100): Promise<void> {
    if (this.context) return;
    this._state = 'initializing';

    try {
      this.context = new AudioContext({ sampleRate });
      await this.context.audioWorklet.addModule('/worklets/audio-processor.js');

      this.workletNode = new AudioWorkletNode(this.context, 'nuit-audio-processor');
      this.workletNode.port.onmessage = this.handleMessage.bind(this);

      // Send init message to worklet
      this.workletNode.port.postMessage({ type: 'init' });
      this._state = 'running';
    } catch (err) {
      this._state = 'error';
      throw err;
    }
  }

  private handleMessage(event: MessageEvent) {
    const { type } = event.data;
    if (type === 'ready') {
      console.log('[WorkletBridge] AudioWorklet processor ready');
    }
  }

  async resume(): Promise<void> {
    if (this.context?.state === 'suspended') {
      await this.context.resume();
      this._state = 'running';
    }
  }

  async suspend(): Promise<void> {
    if (this.context?.state === 'running') {
      await this.context.suspend();
      this._state = 'suspended';
    }
  }

  connectSource(source: MediaStreamAudioSourceNode): void {
    if (!this.workletNode || !this.context) {
      throw new Error('WorkletBridge not initialized');
    }
    source.connect(this.workletNode);
    this.workletNode.connect(this.context.destination);
  }

  async destroy(): Promise<void> {
    this.workletNode?.disconnect();
    await this.context?.close();
    this.workletNode = null;
    this.context = null;
    this._state = 'uninitialized';
  }
}
