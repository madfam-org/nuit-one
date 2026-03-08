import { StemPlayer } from '$lib/audio/stem-player.js';

interface StemInfo {
  name: string;
  volume: number;
  muted: boolean;
  solo: boolean;
  pan: number;
  eqLow: number;
  eqMid: number;
  eqHigh: number;
  reverbAmount: number;
}

export function createPlayerStore(externalCtx?: AudioContext) {
  let player: StemPlayer | null = null;
  const sharedCtx = externalCtx;
  let isPlaying = $state(false);
  let currentTime = $state(0);
  let duration = $state(0);
  let loading = $state(false);
  let stems = $state<StemInfo[]>([]);
  let loopStart = $state<number | null>(null);
  let loopEnd = $state<number | null>(null);
  let isLooping = $state(false);
  let animFrameId: number | null = null;

  function tick() {
    if (player) {
      currentTime = player.currentTime;
      isPlaying = player.isPlaying;
    }
    if (isPlaying) {
      animFrameId = requestAnimationFrame(tick);
    }
  }

  function startTicking() {
    if (animFrameId) cancelAnimationFrame(animFrameId);
    animFrameId = requestAnimationFrame(tick);
  }

  function stopTicking() {
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
    if (player) {
      currentTime = player.currentTime;
      isPlaying = player.isPlaying;
    }
  }

  return {
    get isPlaying() { return isPlaying; },
    get currentTime() { return currentTime; },
    get duration() { return duration; },
    get loading() { return loading; },
    get stems() { return stems; },
    get player() { return player; },
    get loopStart() { return loopStart; },
    get loopEnd() { return loopEnd; },
    get isLooping() { return isLooping; },

    async loadStems(stemUrls: Record<string, string>) {
      loading = true;
      player?.destroy();
      player = new StemPlayer(sharedCtx);

      try {
        for (const [name, url] of Object.entries(stemUrls)) {
          await player.loadStem(name, url);
        }

        duration = player.duration;

        stems = player.stemNames.map((name) => ({
          name,
          volume: 1,
          muted: false,
          solo: false,
          pan: 0,
          eqLow: 0,
          eqMid: 0,
          eqHigh: 0,
          reverbAmount: 0,
        }));
      } finally {
        loading = false;
      }
    },

    play() {
      player?.play();
      isPlaying = true;
      startTicking();
    },

    pause() {
      player?.pause();
      isPlaying = false;
      stopTicking();
    },

    stop() {
      player?.stop();
      isPlaying = false;
      currentTime = 0;
      stopTicking();
    },

    togglePlayback() {
      if (isPlaying) {
        this.pause();
      } else {
        this.play();
      }
    },

    seek(seconds: number) {
      player?.seek(seconds);
      currentTime = seconds;
      if (isPlaying) startTicking();
    },

    setVolume(stemName: string, vol: number) {
      player?.setVolume(stemName, vol);
      const stem = stems.find((s) => s.name === stemName);
      if (stem) {
        stem.volume = vol;
        stem.muted = vol === 0;
      }
    },

    toggleMute(stemName: string) {
      player?.toggleMute(stemName);
      const stem = stems.find((s) => s.name === stemName);
      if (stem) stem.muted = !stem.muted;
    },

    solo(stemName: string) {
      player?.solo(stemName);
      stems = stems.map((s) => ({
        ...s,
        muted: s.name !== stemName,
        solo: s.name === stemName,
      }));
    },

    unsolo() {
      player?.unsolo();
      stems = stems.map((s) => ({
        ...s,
        muted: false,
        solo: false,
      }));
    },

    setPan(stemName: string, value: number) {
      player?.setPan(stemName, value);
      const stem = stems.find((s) => s.name === stemName);
      if (stem) stem.pan = value;
    },

    setEq(stemName: string, band: 'low' | 'mid' | 'high', gain: number) {
      player?.setEq(stemName, band, gain);
      const stem = stems.find((s) => s.name === stemName);
      if (stem) {
        if (band === 'low') stem.eqLow = gain;
        else if (band === 'mid') stem.eqMid = gain;
        else stem.eqHigh = gain;
      }
    },

    setReverbSend(stemName: string, amount: number) {
      player?.setReverbSend(stemName, amount);
      const stem = stems.find((s) => s.name === stemName);
      if (stem) stem.reverbAmount = amount;
    },

    setLoopRegion(start: number, end: number) {
      player?.setLoopRegion(start, end);
      loopStart = start;
      loopEnd = end;
      isLooping = true;
    },

    clearLoopRegion() {
      player?.clearLoopRegion();
      loopStart = null;
      loopEnd = null;
      isLooping = false;
    },

    destroy() {
      stopTicking();
      player?.destroy();
      player = null;
      isPlaying = false;
      currentTime = 0;
      duration = 0;
      stems = [];
      loopStart = null;
      loopEnd = null;
      isLooping = false;
    },
  };
}

export type PlayerStore = ReturnType<typeof createPlayerStore>;
