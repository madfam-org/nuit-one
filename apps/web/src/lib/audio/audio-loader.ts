/**
 * Fetches audio from the COEP-safe proxy route and decodes it.
 */
export async function loadAudioBuffer(
  ctx: AudioContext,
  proxyUrl: string,
): Promise<AudioBuffer> {
  const response = await fetch(proxyUrl);
  if (!response.ok) {
    throw new Error(`Failed to load audio: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return ctx.decodeAudioData(arrayBuffer);
}
