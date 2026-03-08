import { StemPlayer } from '$lib/audio/stem-player.js';

interface StemInfo {
  name: string;
  volume: number;
  muted: boolean;
  solo: boolean;
}

export function createPlayerStore() {
  let player: StemPlayer | null = null;
  let isPlaying = $state(false);
  let currentTime = $state(0);
  let duration = $state(0);
  let loading = $state(false);
  let stems = $state<StemInfo[]>([]);
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
    // Sync final state
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

    async loadStems(stemUrls: Record<string, string>, bassKaraokeMode = true) {
      loading = true;
      player?.destroy();
      player = new StemPlayer();

      try {
        for (const [name, url] of Object.entries(stemUrls)) {
          await player.loadStem(name, url);
        }

        duration = player.duration;

        // Set up stem info
        stems = player.stemNames.map((name) => ({
          name,
          volume: 1,
          muted: false,
          solo: false,
        }));

        // Bass karaoke mode: mute bass, full volume on accompaniment
        if (bassKaraokeMode) {
          const bassIdx = stems.findIndex((s) => s.name === 'bass');
          if (bassIdx >= 0) {
            stems[bassIdx]!.volume = 0;
            stems[bassIdx]!.muted = true;
            player.mute('bass');
          }
        }
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

    destroy() {
      stopTicking();
      player?.destroy();
      player = null;
      isPlaying = false;
      currentTime = 0;
      duration = 0;
      stems = [];
    },
  };
}

export type PlayerStore = ReturnType<typeof createPlayerStore>;
