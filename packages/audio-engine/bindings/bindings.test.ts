import { describe, expect, it, vi } from 'vitest';
import { type AudioEngineModule, allocateBuffer, freeBuffer, loadAudioEngine } from './index';

describe('bindings exports', () => {
  it('exports loadAudioEngine as a function', () => {
    expect(typeof loadAudioEngine).toBe('function');
  });

  it('exports allocateBuffer as a function', () => {
    expect(typeof allocateBuffer).toBe('function');
  });

  it('exports freeBuffer as a function', () => {
    expect(typeof freeBuffer).toBe('function');
  });
});

describe('allocateBuffer', () => {
  it('returns ptr and a Float32Array of the correct length', () => {
    const length = 128;
    const heapBuffer = new ArrayBuffer(4096);
    const heapF32 = new Float32Array(heapBuffer);
    const mallocOffset = 256; // byte offset returned by _malloc

    const mockModule: AudioEngineModule = {
      _init_engine: vi.fn(),
      _process_audio: vi.fn(),
      _get_buffer_ptr: vi.fn(),
      _malloc: vi.fn().mockReturnValue(mallocOffset),
      _free: vi.fn(),
      HEAPF32: heapF32,
    };

    const result = allocateBuffer(mockModule, length);

    expect(mockModule._malloc).toHaveBeenCalledWith(length * Float32Array.BYTES_PER_ELEMENT);
    expect(result.ptr).toBe(mallocOffset);
    expect(result.array).toBeInstanceOf(Float32Array);
    expect(result.array.length).toBe(length);
    expect(result.array.buffer).toBe(heapBuffer);
  });
});

describe('freeBuffer', () => {
  it('calls _free with the correct pointer', () => {
    const ptr = 512;

    const mockModule: AudioEngineModule = {
      _init_engine: vi.fn(),
      _process_audio: vi.fn(),
      _get_buffer_ptr: vi.fn(),
      _malloc: vi.fn(),
      _free: vi.fn(),
      HEAPF32: new Float32Array(0),
    };

    freeBuffer(mockModule, ptr);

    expect(mockModule._free).toHaveBeenCalledOnce();
    expect(mockModule._free).toHaveBeenCalledWith(ptr);
  });
});
