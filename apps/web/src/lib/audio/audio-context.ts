// Singleton AudioContext factory
// Ensures one shared AudioContext across the entire app so audio
// survives navigation between routes.

let sharedContext: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!sharedContext || sharedContext.state === 'closed') {
    sharedContext = new AudioContext();
  }
  return sharedContext;
}

export async function resumeContext(): Promise<void> {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
}

export function getContextState(): AudioContextState | 'uninitialized' {
  if (!sharedContext) return 'uninitialized';
  return sharedContext.state;
}
