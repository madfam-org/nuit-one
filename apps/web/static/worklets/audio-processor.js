class NuitAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.wasmReady = false;
    this.port.onmessage = this.handleMessage.bind(this);
  }

  handleMessage(event) {
    const { type } = event.data;
    switch (type) {
      case 'init':
        this.wasmReady = true;
        this.port.postMessage({ type: 'ready' });
        break;
      case 'stop':
        this.wasmReady = false;
        break;
    }
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];

    if (!this.wasmReady || !input || !output) {
      return true;
    }

    // Phase 0: Passthrough to prove AudioWorklet pipeline
    for (let channel = 0; channel < output.length; channel++) {
      const inputChannel = input[channel];
      const outputChannel = output[channel];
      if (inputChannel && outputChannel) {
        outputChannel.set(inputChannel);
      }
    }

    return true;
  }
}

registerProcessor('nuit-audio-processor', NuitAudioProcessor);
