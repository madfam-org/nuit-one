import { encodeWav } from './wav-encoder.js';

export type ExportFormat = 'wav' | 'mp3';
export type Mp3Quality = 128 | 192 | 320;

interface ExportOptions {
  format: ExportFormat;
  mp3Kbps?: Mp3Quality;
}

/**
 * Mix all stems and export as WAV or MP3.
 * Uses OfflineAudioContext for non-realtime rendering.
 */
export async function exportMix(
  buffers: Map<string, { buffer: AudioBuffer; volume: number; muted: boolean; pan: number }>,
  duration: number,
  sampleRate: number,
  options: ExportOptions,
): Promise<Blob> {
  const offline = new OfflineAudioContext(2, Math.ceil(duration * sampleRate), sampleRate);

  for (const [, stem] of buffers) {
    if (stem.muted) continue;

    const source = offline.createBufferSource();
    source.buffer = stem.buffer;

    const gain = offline.createGain();
    gain.gain.value = stem.volume;

    const panner = offline.createStereoPanner();
    panner.pan.value = stem.pan;

    source.connect(gain);
    gain.connect(panner);
    panner.connect(offline.destination);
    source.start(0);
  }

  const rendered = await offline.startRendering();

  if (options.format === 'wav') {
    return encodeWav(rendered);
  }

  // MP3 encoding via lamejs (loaded lazily)
  return encodeMp3(rendered, options.mp3Kbps ?? 192);
}

async function encodeMp3(buffer: AudioBuffer, kbps: number): Promise<Blob> {
  // Dynamic import for tree-shaking
  // @ts-expect-error lamejs has no proper types
  const lamejs = await import('lamejs');
  const mp3encoder = new lamejs.Mp3Encoder(buffer.numberOfChannels, buffer.sampleRate, kbps);

  const left = convertTo16Bit(buffer.getChannelData(0));
  const right = buffer.numberOfChannels > 1 ? convertTo16Bit(buffer.getChannelData(1)) : left;

  const mp3Data: BlobPart[] = [];
  const blockSize = 1152;

  for (let i = 0; i < left.length; i += blockSize) {
    const leftChunk = left.subarray(i, i + blockSize);
    const rightChunk = right.subarray(i, i + blockSize);
    const mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
    if (mp3buf.length > 0) mp3Data.push(new Uint8Array(mp3buf));
  }

  const flush = mp3encoder.flush();
  if (flush.length > 0) mp3Data.push(new Uint8Array(flush));

  return new Blob(mp3Data, { type: 'audio/mp3' });
}

function convertTo16Bit(float32: Float32Array): Int16Array {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]!));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16;
}
