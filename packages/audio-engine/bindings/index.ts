// TypeScript interface for the WASM audio engine module
export interface AudioEngineModule {
  _init_engine(sampleRate: number, bufferSize: number): number;
  _process_audio(inputPtr: number, outputPtr: number, numFrames: number): number;
  _get_buffer_ptr(): number;
  _malloc(size: number): number;
  _free(ptr: number): void;
  HEAPF32: Float32Array;
}

export type AudioEngineFactory = () => Promise<AudioEngineModule>;

/**
 * Load the WASM audio engine module.
 * The .wasm file must be served from the same origin or with proper CORS headers.
 */
export async function loadAudioEngine(wasmUrl: string): Promise<AudioEngineModule> {
  const { default: factory } = await import(/* @vite-ignore */ wasmUrl);
  return factory() as Promise<AudioEngineModule>;
}

/**
 * Allocate a Float32Array in WASM memory.
 */
export function allocateBuffer(module: AudioEngineModule, length: number): { ptr: number; array: Float32Array } {
  const ptr = module._malloc(length * Float32Array.BYTES_PER_ELEMENT);
  const array = new Float32Array(module.HEAPF32.buffer, ptr, length);
  return { ptr, array };
}

/**
 * Free a previously allocated buffer.
 */
export function freeBuffer(module: AudioEngineModule, ptr: number): void {
  module._free(ptr);
}
