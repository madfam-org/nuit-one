/**
 * AudioWorklet processor that loads and runs the WASM audio engine.
 * This file must be served as a separate script (not bundled).
 * Copy to apps/web/static/worklets/audio-processor.js for development.
 */

// Note: This is a TypeScript source file. The actual worklet processor
// will be a plain JS file in apps/web/static/worklets/ since AudioWorklet
// processors cannot use ES modules in all browsers.

export const WORKLET_PROCESSOR_SOURCE = `
class NuitAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.wasmReady = false;
    this.port.onmessage = this.handleMessage.bind(this);
  }

  handleMessage(event) {
    const { type, data } = event.data;
    switch (type) {
      case 'init':
        // WASM initialization will be handled here in Phase 1
        this.wasmReady = true;
        this.port.postMessage({ type: 'ready' });
        break;
      case 'stop':
        this.wasmReady = false;
        break;
    }
  }

  process(inputs, outputs, _parameters) {
    const input = inputs[0];
    const output = outputs[0];

    if (!this.wasmReady || !input || !output) {
      return true;
    }

    // Phase 0: Simple passthrough to prove AudioWorklet pipeline works
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
`;
